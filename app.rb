require 'sinatra'
require 'sinatra/content_for'
require 'haml'
require 'sequel'
require './grid'

# Connect to SQLite database
DB = Sequel.sqlite('./testdb.db')

# Define tables if they don't exist
DB.create_table?(:scores) do
  primary_key :id
  String :name
  String :normalized_name
  String :time
  String :level
  Float :score
  Boolean :is_best_score, default: false
  DateTime :created_at
end

DB.create_table?(:items) do
  String :text, primary_key: true
end

# Model Definitions
class Score < Sequel::Model
  CHART_SIZE = 10
  
  plugin :timestamps, update_on_create: true

  def update_best_score
    best = nil
    scores_same_name = Score.where(normalized_name: normalized_name)
    scores_same_name.each do |s|
      best = s if best.nil? || s.score > best.score
    end
    scores_same_name.each do |s|
      s.update(is_best_score: (s == best))
    end
  end
  
  def self.chart(opts={})
    days = opts[:days] || nil
    limit = opts[:limit] || CHART_SIZE
    
    dataset = Score.order(Sequel.desc(:score))
    dataset = dataset.where(is_best_score: true) if opts[:single_entries]
    dataset = dataset.where{created_at > Time.now - 60*60*24*days} if days

    dataset.limit(limit).all
  end
  
  def self.recent_chart(opts={})
    num_of_plays = limit = CHART_SIZE
    last = order(Sequel.desc(:created_at)).limit(num_of_plays, num_of_plays).first
    if last
      time = last.created_at
      where{created_at > time}.order(Sequel.desc(:score)).all
    else
      order(Sequel.desc(:score)).all
    end
  end
  
  def self.recent_games
    scores = []
    names = Hash.new(0)
    order(Sequel.desc(:created_at)).each do |s|
      name = s.normalized_name
      names[name] += 1
      if names[name] <= 2
        scores << s
        break if scores.size >= CHART_SIZE
      end
    end
    scores.sort_by { |x| -x.score }
  end
  
  def self.recent_players(limit=CHART_SIZE)
    res = {}
    order(Sequel.desc(:created_at)).each do |s|
      name = s.normalized_name
      is_new_name = !res.key?(name)
      break if res.size >= limit && is_new_name
      
      if s.score > 0 && (is_new_name || s.score > res[name].score)
        res[name] = s
      end
    end
    res.values.sort_by { |x| -x.score }
  end
  
  def self.update_scores
    all.each(&:update_score)
  end

  def self.update_best_scores
    all.each(&:update_best_score)
  end
  
  def self.strip_names
    all.each do |s|
      s.update(name: s.name.strip, normalized_name: s.name.strip.downcase)
    end
  end
  
  def self.remove_blacklisted
    blacklist = [/blacklisted/]
    all.each do |s|
      blacklist.each do |m|
        s.destroy if s.name =~ m
      end
    end
  end
end

class Item < Sequel::Model
  set_primary_key :text
end

configure do
  Sequel::Model.raise_on_save_failure = true

  #Score.all().each {|s| s.destroy if s.name != 'f'}
  month = 2592000
  use Rack::Session::Cookie, expire_after: month*3
  #enable :sessions
end

helpers do  
  include Rack::Utils  
  alias_method :h, :escape_html

  def load_game
    @chart = [] # Score.recent_players(5)
    @name = session[:name]
    @already_played = session[:already_played]
    haml :index
  end

  def show_hiscores
    @overAllChart = Score.chart(single_entries: true)
    @recentChart = Score.recent_chart
    @recentPeopleChart = Score.recent_players
    haml :hiscores
  end
  
  def partial( page, variables={} )
    haml page.to_sym, {layout:false}, variables
  end
  
  def moves_quality(num)
    case num
    when 0 then 'good'
    when 1..3 then 'average'
    else 'bad'
    end
  end

  def base_url
    "#{request.env['rack.url_scheme']}://#{request.env['HTTP_HOST']}"
  end
end  



get '/' do
  load_game
end

get '/expert' do
  @expert_mode = true
  load_game
end


# used to keep dyno alive through uptimerobot.com
get '/ping' do
  'PONG'
end

get '/level' do
  level = params['level'].to_i
  files = Dir.glob("levels/#{level}/*")
  filename = files[rand files.length]
  File.read(filename)
end

get '/rules' do
  haml :rules
end

get '/privatechart/:order' do
  @chart = Score.all(order: [params[:order].to_sym.desc])
  haml :privatechart
end


def get_or_post(path, opts={}, &block)
  get(path, opts, &block)
  post(path, opts, &block)
end

post '/submitscore' do
  name = h params[:name][0...14].strip
  if (name.size < 1)
    show_hiscores
    return
  end

  level = h params[:level]
  score = params[:score].to_f

  session[:already_played] = true if score > 10
  
  session[:name] = name
  
  @new_score = Score.create(name: name, normalized_name: name.downcase, level: level, score: score, created_at: Time.now)
  @new_score.save
  @new_score.update_best_score

  redirect "/hiscores?newscore=#{@new_score.id}"
end

get '/hiscores' do
  @new_score_id = params[:newscore].to_i
  show_hiscores
end

get '/test' do
  haml :test, layout: false
end

get '/comments' do
  haml :comments
end


