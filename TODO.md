
Note to self about postgres:

use databse: \connect the_magic_eye

execute script: psql -h host -p port -d dbname -U username -f datafile.sql


//=====================
// ALGORITHM FOR DEALING WITH FALSE POSITIVES:
// bot makes a mistake because the image was not the same
// person replies, bot marks the post as watching
//...
// mod fixes it
//...
// wake up
// get all watching posts in a certain time period (ignore all old ones)
// if they've been fixed, we made a mistake
// take the hash of that image and make a new entry so there's a closer match (??)
//=====================

//=====================
// TODO:
// mods should be able to login, enter a url, see the info and fix it
// we will need a total reset for individual rules
// needs to get the latest rules wordings, from somewhere (not sure if they can be pulled from wiki page /wiki/toolbox has some but may need manual input)
//--
// need to talk to redis
//=====================

//=====================
//Schemas
// LINK SCHEMA 
// link
// direct link to image
// hash
// watching
// last posted
// removal reason (null if not removed)
// duplicate | id of duplicate

// SERVER
// Currently checking
//=====================
