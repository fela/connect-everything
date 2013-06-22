#!/usr/bin/env ruby

# this file is used to generate levels
require './grid'
require 'securerandom'
require 'fileutils'

# destination directory
DEST_DIR = './levels'
N = 1 # how many get generated for each level
N_LEVELS = Grid.n_levels + 1
KEEP_OLD_LEVELS = true

(1).upto(N_LEVELS).each do |level|
  print "generating level #{level}"
  unless KEEP_OLD_LEVELS
    FileUtils.remove_dir("levels/#{level}", force: true)
    FileUtils.mkdir("levels/#{level}")
  end
  N.times do
    print '.'
    str = Grid.generate(level: level, verbose: false).serialize
    random_name = SecureRandom.hex
    filename = [DEST_DIR, level, random_name].join('/')
    File.write(filename, str)
  end
  puts
end



