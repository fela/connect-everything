require 'sinatra'
require 'sinatra/content_for'
require 'haml'
require 'data_mapper'
require './grid'

class Score
  include DataMapper::Resource
  
  property :id,         Serial    # An auto-increment integer key
  property :name,       String
  property :normalized_name, String
  property :time,       String
  property :level, String
  property :score,      Float
  property :is_best_score, Boolean, default: false
  property :created_at, DateTime

  CHART_SIZE = 10
  
  def update_best_score
    # find best score
    best = nil
    scores_same_name = Score.all(level: level, normalized_name: normalized_name)
    scores_same_name.each do |s|
      if best == nil || s.score < best.score
        best = s
      end
    end
    scores_same_name.each do |s|
      s.is_best_score = (s == best)
      s.save
      # for db simplification
      #s.destroy if !s.is_best_score
    end
  end
  
  def self.chart(opts={})
    days = opts[:days] || nil
    limit = opts[:limit] || CHART_SIZE
    
    
    options = {order: [:score.asc]}
    if opts[:single_entries]
      options[:is_best_score] = true
    end
    
    if opts[:level]
      options[:level] = opts[:level]
    end

    if days
      time = Time.now - 60*60*24*days
      options[:created_at.gt] = time
    end
    
    all(options)[0...limit]
  end
  
  def self.recent_chart(opts={})
    num_of_plays = limit = CHART_SIZE

    options = {order: [:created_at.desc]}
    if opts[:level]
      options[:level] = opts[:level]
    end

    last = all(options)[num_of_plays]
    options[:order] = [:score.asc]
    if last
      time = last.created_at
      options[:created_at.gt] = time
    end
    all(options)#[0...limit]
  end
  
  def self.recent_games
    scores = []
    names = {}
    names.default = 0
    all(order: [:created_at.desc]).each do |s|
      name = s.normalized_name
      names[name] += 1
      if names[name] <= 2
        scores << s
        break if scores.size == CHART_SIZE
      end
    end
    scores.sort_by{|x| x.score}
  end
  
  def self.recent_players(opts={}, limit=CHART_SIZE)
    res = {} # name to highest score
    options = {order: [:created_at.desc]}
    if opts[:level]
      options[:level] = opts[:level]
    end
    all(options).each do |s|
      # end after 10th name
      # but first check for other games by same authors
      name = s.normalized_name
      isnewname = !res.has_key?(name)
      break if res.size == limit && isnewname
      
      if isnewname or s.score < res[name].score
        res[name] = s
      end
    end
    res.values.sort_by{|x| x.score}
  end
  
  def self.update_scores
    all().each {|s| s.update_score}
  end

  def self.update_best_scores
    all().each {|s| s.update_best_score}
  end
  def self.strip_names
    all().each {|s|s.name = s.name.strip; s.normalized_name = s.name.downcase; s.save}
  end
  def self.remove_blacklisted
    blacklist = [/blacklisted/]
    all().each do |s|
      blacklist.each do |m|
        if s.name =~ m
          s.destroy
          break
        end
      end
    end
  end
end

class Item
  include DataMapper::Resource
 
  property :text, String,:key => true
end



 
configure do
  DataMapper.setup(:default, ENV['DATABASE_URL'] || 'postgres://fela:test@localhost/connect2')
  DataMapper.finalize
  # uncomment the following two lines the first time you run!
  #DataMapper.auto_upgrade!
  #DataMapper.auto_migrate!
  #Score.strip_names
  #Score.update_best_scores
  #Score.remove_blacklisted
  DataMapper::Model.raise_on_save_failure = true
  
  #Score.update_scores
  #Score.rename_difficulties
  #Score.all().each {|s| s.destroy if s.name != 'f'}
  month = 2592000
  use Rack::Session::Cookie, expire_after: month*3
  #enable :sessions
end

helpers do  
  include Rack::Utils  
  alias_method :h, :escape_html

  def load_game(level=9)
    @chart = Score.recent_players({level: level}, 5)
    @name = session[:name]
    @already_played = session[:already_played]
    haml :index
  end

  def show_hiscores(opts={})
    @overAllChart = Score.chart(opts.merge({single_entries: true}))
    @recentChart = Score.recent_chart(opts)
    @recentPeopleChart = Score.recent_players(opts)
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

get '/play' do
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

get '/hiscores/:level' do
  @new_score_id = params[:newscore].to_i
  show_hiscores(level: params[:level])
end

get '/test' do
  haml :test, layout: false
end

get '/comments' do
  haml :comments
end


