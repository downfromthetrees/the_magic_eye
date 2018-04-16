f Dhash.hamming(hash1, hash2) < 10
  puts "Images are very similar"
else
  puts "No match"
end



good2 - watermark
==============Begin tests==============
hamming same image:  0
hamming diff dhash:  4
hamming diff phash:  null
phash lib eq same:  true
phash lib eq diff:  true
phash lib compare same:  0
phash lib compare diff:  1.1170000000000


bad2 - complete difference
==============Begin tests==============
hamming same image:  0
hamming diff dhash:  13
hamming diff phash:  null
phash lib eq same:  true
phash lib eq diff:  false
phash lib compare same:  0
phash lib compare diff:  217.06359999999995
==============End tests==============

bad - lots of whitespace difference
==============Begin tests==============
hamming same image:  0
hamming diff dhash:  6
hamming diff phash:  null
phash lib eq same:  true
phash lib eq diff:  false
phash lib compare same:  0
phash lib compare diff:  39.10759999999999
==============End tests==============

bad3 - less whitespace difference
==============Begin tests==============
hamming same image:  0
hamming diff dhash:  6
hamming diff phash:  null
phash lib eq same:  true
phash lib eq diff:  true
phash lib compare same:  0
phash lib compare diff:  9.606400000000004
==============End tests==============