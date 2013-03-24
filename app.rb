require 'sinatra'
require 'haml'
require 'data_mapper' 

class Score
  include DataMapper::Resource
  
  property :id,         Serial    # An auto-increment integer key
  property :name,       String
  property :time,       String
  property :moves,      Integer
  property :difficulty, String
  property :points,     Float
  property :is_best_score, Boolean, default: false
  property :created_at, DateTime
  
  def update_best_score
    # find best score
    best = nil
    #scoresSameName = Score.all(name: name, difficulty: difficulty);
    scoresSameName = Score.all(name: name);
    scoresSameName.each do |s|
      if best == nil || s.points > best.points
        best = s
      end
    end
    scoresSameName.each do |s|
      s.is_best_score = (s == best)
      s.save
    end
  end
  
  def self.chart(opts={})
    days = opts[:days] || nil
    limit = opts[:limit] || 10
    
    
    options = {order: [:points.desc]}
    if opts[:single_entries]
      options[:is_best_score] = true
    end
    
    if days
      time = Time.now - 60*60*24*days
      options[:created_at.gt] = time
    end
    
    return all(options)[0...limit]
  end
end

class Item
  include DataMapper::Resource
 
  property :text, String,:key => true
end
 
configure do
  DataMapper.setup(:default, ENV['DATABASE_URL'] || 'postgres://fela:@localhost/net-connect')
  DataMapper.finalize
  #DataMapper.auto_upgrade!
  #DataMapper.auto_migrate!
  DataMapper::Model.raise_on_save_failure = true
  enable :sessions
end

helpers do  
  include Rack::Utils  
  alias_method :h, :escape_html
  
  def show_hiscores
    @scores = Score.chart(single_entries: true)
    @dailyScores = Score.chart(days: 1)
    @weeklyScores = Score.chart(days: 7)
    haml :hiscores
  end
  
  def partial( page, variables={} )
    haml page.to_sym, {layout:false}, variables
  end
end  




get '/' do
  haml :index
end

get '/rules' do
  haml :rules
end

post '/gamewon' do
  # params should contain: difficulty, time, moves and the score
  @params = params
  @name = session[:name]
  @dailyChart = Score.chart(days: 1)
  haml :submitscore
end

def get_or_post(path, opts={}, &block)
  get(path, opts, &block)
  post(path, opts, &block)
end

post '/submitscore' do
  name = h params[:name][0...16] # limit max size
  if (name.size < 1)
    show_hiscores
    return
  end
  
  time = h params[:time]
  moves = (h params[:moves]).to_i
  difficulty = h params[:difficulty]
  points = params[:points]
  
  session[:name] = name
  
  @newScore = Score.create(name: name, time: time, moves: moves, difficulty: difficulty, points: points, created_at: Time.now)
  @newScore.save
  @newScore.update_best_score
  
  
  show_hiscores
end

get '/hiscores' do
  show_hiscores
end


