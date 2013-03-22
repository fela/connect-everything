require 'sinatra'
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
  send_file 'public/index.html'
end

