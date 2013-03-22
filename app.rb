require 'sinatra'
require 'haml'
require 'data_mapper'
 
class Item
  include DataMapper::Resource
 
  property :text, String,:key => true
end
 
configure do
  DataMapper.setup(:default, 'postgres://fela:@localhost/net-connect')
  DataMapper.finalize
  DataMapper.auto_migrate!
 
  Item.create(:text => "hi")
end

get '/' do
  haml :index
end

get '/submitscore' do
  @score = 222.2121;
  @time = '1:02';
  @penalty = 4;
  haml :submitscore
end
