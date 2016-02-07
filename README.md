Source code of [Connect Everything!](http://connect-everything-salogel42.c9.io/)

# Instructions for setting up your own version

* Fork this repository
* Go to c9.io and sign up with GitHub
* Create a new workspace from the repository, selecting the Ruby template
* install postgres with `sudo apt-get install postgresql postgresql-server-dev-9.3 libpq-dev`
* Use the `bundle` command to grab all the necessary libraries.  May need to manually `sudo gem install` some libs if they fail.
* Start the postgres server with `sudo service postgresql start`
* Go into postgres with `sudo sudo -u postgres psql`
* In postgres
```
create user fela with password 'test';
create database connect2 owner fela;
\q
```
* Go into `app.rb` and uncomment the lines `DataMapper.auto_upgrade!` and `DataMapper.auto_migrate!` (TODO(sdspikes): add command line arg for this)
    * re-comment them after first launch, unless you want to blow away the data 
* Launch the app with `ruby app.rb -p $PORT -o $IP`


```
Copyright (C) 2012-2014  Fela Winkelmolen

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 2 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
```
