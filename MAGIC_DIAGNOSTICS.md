

1       = 100b  (justdhash = 25b)
10      = 1kb
10000   = 1mb   
300,000 = 30mb  (justdhash = 7.5mb) 
1m      = 100mb



1kb = 2
1kb-phash = 4

2000 = 1m
25






dhashme.jpg        =Bad gun
C31707234F4D4948

dhashme2.png       - good gun
C70707434F4D4D4C
dhashme2.jpg     - good gun
C30707634F4D4948

dhashme3.jpg     - cut gun
03E22301048E0E0F

dhashme4.jpg     - troll
0B1B2727C7C16337



badgun/goodgun = 5
goodgun/goodgunpng = 4
badgun/cut = 15
badgun/troll = 13






phash: { fileFormat: 'image/png',
  width: 877,
  height: 645,
  colorType: 'TrueColorAlpha',
  pHash: '002500510150019603030339026804360574084704030551056508310029-03801540004027700450278009105610262037201120589016000320028016001540281028402860277057205650374037506260583' }








HAMMING ===================

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



f Dhash.hamming(hash1, hash2) < 10
  puts "Images are very similar"
else
  puts "No match"
end