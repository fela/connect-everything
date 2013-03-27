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
  
  def self.rename_difficulties
    all().each do |s|
      s.difficulty = case s.difficulty
      when 'easy' then 'easiest'
      when 'medium' then 'easy'
      when 'hard' then 'medium'
      when 'hardest' then 'hard'
      end
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
    
    all(options)[0...limit]
  end
  
  def self.recent_chart(opts={})
    limit = 10
    num_of_plays = 10
    time = all(order: [:created_at.desc])[num_of_plays].created_at
    all(:created_at.gt => time, order:[:points.desc])[0...limit]
  end
  
  def self.recent_games
    limit = 10
    scores = []
    names = {}
    names.default = 0
    all(order: [:created_at.desc]).each do |s|
      names[s.name] += 1
      if names[s.name] <= 2
        scores << s
        break if scores.size == 10
      end
    end
    scores.sort_by{|x|-x.points}
  end
  
  def self.recent_players
    limit = 10
    res = {} # name to highest score
    ending = false
    lastname = ''
    all(order: [:created_at.desc]).each do |s|
      # end after 10th name
      # but first check for other games by same author
      if res.size == limit && !ending
        ending = true
        lastname = s.name
      end
      break if ending && s.name != lastname
      
      old = res[s.name]
      if old.nil? or s.points > old.points
        res[s.name] = s
      end
    end
    res.values.sort_by{|x|-x.points}
  end
  
  def update_score
    mins, secs = time.split(':')
    mins = mins.to_f + secs.to_f / 60.0
    time_score = 1.0/mins**0.5
    
    n_cells = {'easiest'=>5*5, 'easy'=>7*7, 'medium'=>9*9, 'hard'=>9*9}
    difficulty_score = n_cells[difficulty]**2
    
    move_score = 0.5**(moves**0.6);
    
    mult_factor = 0.5
    self.points = (mult_factor * difficulty_score * time_score * move_score)**0.5
    save
  end
  
  def self.update_scores
    all().each {|s| s.update_score}
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
  
  #Score.update_scores
  #Score.rename_difficulties
  enable :sessions
end

helpers do  
  include Rack::Utils  
  alias_method :h, :escape_html
  
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
end  




get '/' do
  haml :index
end

get '/rules' do
  haml :rules
end

get '/privatechart/:order' do
  @chart = Score.all(order: [params[:order].to_sym.desc])
  haml :privatechart
end

post '/gamewon' do
  # params should contain: difficulty, time, moves and the score
  @params = params
  @name = session[:name]
  @chart = Score.recent_players
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


