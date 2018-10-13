
# Local development

Magic Eye is pretty simple to develop on and test locally.

* Create a reddit account for your bot
* While logged in as your bot go to https://www.reddit.com/prefs/apps
* Create an app
   * Choose `script`
   * Enter this as the redirect uri: `https://not-an-aardvark.github.io/reddit-oauth-helper/`
   * Record the client id ([under the name](https://i.imgur.com/dcl8EY8.png)), and secret. You'll need them in a momment.
----
* Create an account on mlab.com and go through the steps to create a new database.
* Create a new user for your database.
* Grab the url (inserting relevant parts). It'll look like `mongodb://mycoolname:mycoolpassword@ds125293.mlab.com:25293/mycooldb`
----
* Create a copy of `env.template` and call it `.env`
* Fill in the details of `.env`
    * `ACCOUNT_USERNAME`=username of bot you created above
    * `ALLOW_INVITES`=`allow`
    * `CLIENT_ID`=client id above
    * `CLIENT_SECRET`=client secret above
    * `DAYS_EXPIRY`=number of days before submission/user entries expire
    * `EXTERNAL_DATABASES`=A comma separated list of mongoDB database urls (one is fine, same one as `MONGODB_URI` is fine)
    * `LOG_LEVEL`=`info` (change to `debug` for more information)
    * `MONGODB_URI`= mongoDB url for master data
    * `NODE_ENV`=`develop`
    * `PASSWORD`= password of your bot account

