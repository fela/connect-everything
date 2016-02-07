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
  property :time,       Float
  property :level,      Integer
  property :is_best_score, Boolean, default: false
  property :created_at, DateTime

  CHART_SIZE = 10
  
  def update_best_score
    # find best score
    best = nil
    scores_same_name = Score.all(level: level, normalized_name: normalized_name)
    scores_same_name.each do |s|
      if best == nil || s.time < best.time
        best = s
      end
    end
    scores_same_name.each do |s|
      s.is_best_score = (s == best)
      s.save
    end
  end
  
  def self.chart(opts={})
    days = opts[:days] || nil
    limit = opts[:limit] || CHART_SIZE
    
    
    options = {order: [:time.asc]}
    if opts[:single_entries]
      options[:is_best_score] = true
    end
    
    if opts[:level]
      options[:level] = opts[:level]
    end

    if days
      timestamp = Time.now - 60*60*24*days
      options[:created_at.gt] = timestamp
    end
    
    all(options)[0...limit]
  end
  
  def self.recent_chart(opts={})
    num_of_plays = limit = CHART_SIZE

    options = opts.merge({order: [:created_at.desc]})

    last = all(options)[num_of_plays]
    options[:order] = [:time.asc]
    if last
      timestamp = last.created_at
      options[:created_at.gt] = timestamp
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
    scores.sort_by{|x| x.time}
  end
  
  def self.recent_players(opts={}, limit=CHART_SIZE)
    res = {} # name to highest score
    options = opts.merge({order: [:created_at.desc]})
    all(options).each do |s|
      # end after 10th name
      # but first check for other games by same authors
      name = s.normalized_name
      isnewname = !res.has_key?(name)
      break if res.size == limit && isnewname
      
      if isnewname or s.time < res[name].time
        res[name] = s
      end
    end
    res.values.sort_by{|x| x.time}
  end

  def self.best_per_level
    repository(:default).adapter.select('select f.* from ( SELECT MIN(time), level FROM scores group by level) as x inner join scores as f on f.level = x.level and f.time = x.min order by level;')
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
  # DataMapper.auto_upgrade!
  # DataMapper.auto_migrate!
  #Score.strip_names
  #Score.update_best_scores
  #Score.remove_blacklisted
  DataMapper::Model.raise_on_save_failure = true
  # Score.all().each {|s| s.destroy if s.time == 0.0}
  #Score.update_scores
  #Score.rename_difficulties
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
    @dont_play_again = session[:dont_play_again]
    @level = level
    haml :index
  end

  def show_hiscores(opts={})
    @overAllChart = Score.chart(opts.merge({single_entries: true}))
    @recentChart = Score.recent_chart(opts)
    @recentPeopleChart = Score.recent_players(opts)
    @perLevel = Score.best_per_level
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
  load_game()
end

get '/play' do
  @level = params['level'] ? params['level'].to_i : 9
  load_game(@level)
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
  time = params[:time].to_f

  session[:already_played] = true
  
  session[:name] = name
  
  @new_score = Score.create(name: name, normalized_name: name.downcase, level: level, time: time, created_at: Time.now)
  p @new_score
  @new_score.save
  @new_score.update_best_score

  play_again = params[:play_again]
  session[:dont_play_again] = !play_again
  if play_again
    redirect "/play?level=#{level}"
  else
    redirect "/hiscores/#{level}?newscore=#{@new_score.id}"
  end
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


