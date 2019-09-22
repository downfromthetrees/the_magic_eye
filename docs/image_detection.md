# Image detection

For each image a [hash](https://en.wikipedia.org/wiki/Hash_function) is created, i.e. the image is converted into a small string of characters like `B1C1C1236369C950`. Those hashes are then compared and if they are similar enough, it counts as a match.

## Hashing algorithm

Here is the basic algorithm to create the hash:

* The image is shrunk down to a 9x8 pixel image and colours are removed. It now looks like [this](https://i.imgur.com/8k2LTmw.png).

* Each pixel is compared to the horizontally adjacent one, and given a value of 0 for "less bright" and 1 for "more bright"

* This gives 64 bits of information. That is converted into a 16 character hex number (so 2 characters per row of pixels in the shrunken image).

Transparent pixels are ignored.

## Hash comparison

The difference between images is calculated by finding the Hamming distance between two hashes (how many characters are different between the two ids). For example if we have `FFC1C1236369C950` and `B1C1C1236469C950`, 3 characters are different, so the hamming distance is 3.

This is what the 0-16 `tolerance` value is in the Magic Eye settings. When two hashes are compared, the "tolerance" is how many hex values of difference is allowed. 

What this means practically is that for the two strings above, the top of the image was different but the rest of it was extremely similar. Maybe for example a watermark has been added to the top of the image.

This is a simple but considerably effective algorithm, since we are measuring gradients it is not affected by things like image jpegyness or colour alterations. On the other hand, it is affected by cropping. There are lots of things that could be done to alter the algorithm: you could add vertical hashing, or compare in comparison to the mean rather than adjacent pixels etc. But it works pretty well as is.

This is why the Magic Eye documentation says that the bot doesn't "see" images as we do. Gradient comparisons work well, but when there is a misdetection it's not obvious because we focus on colours, image quality etc. rather than gradients.

