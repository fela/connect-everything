services:
  - type: web
    name: connecteverything2
    env: ruby
    plan: free
    buildCommand: "bundle install"
    startCommand: "bundle exec rackup config.ru -p $PORT"
