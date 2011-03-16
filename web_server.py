import web
import urllib
import urllib2
import re
import time
import urlparse
import oauth2 as oauth
import pymongo
import random
import string
import datetime
from pymongo import objectid   
from pymongo import Connection
from pymongo import dbref
        
class index:
  def GET(self):
    web.header("Content-Type","text/html; charset=utf-8")
    f = open('./static/index.html')
    s = f.read()
    f.close()
    return s

class login:
  def GET(self):
    consumer = oauth.Consumer(zaffen.getOauthKey(), zaffen.getOauthSecret())
    client = oauth.Client(consumer)

    resp, content = client.request(zaffen.getRequestTokenUrl(), "GET")
    request_token = dict(urlparse.parse_qsl(content))

    print "Request Token:"
    print "    - oauth_token        = %s" % request_token['oauth_token']
    print "    - oauth_token_secret = %s" % request_token['oauth_token_secret']
    print

    # store the request token
    #
    session['oauth_request_token'] = request_token['oauth_token']
    session['oauth_request_token_secret'] = request_token['oauth_token_secret']

    raise web.seeother("%s?oauth_token=%s&oauth_callback=%s" % (zaffen.getAuthorizeUrl(), request_token['oauth_token'], zaffen.getAuthorizeCallbackUrl()))

class authsub:
  def GET(self):
    if set(("oauth_request_token", "oauth_request_token_secret")) > set(session):
      return web.InternalError()

    consumer = oauth.Consumer(zaffen.getOauthKey(), zaffen.getOauthSecret())
    token = oauth.Token(session['oauth_request_token'], session['oauth_request_token_secret'])
    client = oauth.Client(consumer, token)

    resp, content = client.request(zaffen.getAccessTokenUrl(), "POST")
    access_token = dict(urlparse.parse_qsl(content))

    print "Access Token:"
    print "    - oauth_token        = %s" % access_token['oauth_token']
    print "    - oauth_token_secret = %s" % access_token['oauth_token_secret']
    print
    print "You may now access protected resources using the access tokens above."

    db = zaffen.getDb()

    db.user = {
        '_id' : zaffen.generateUserId(),
        'oauth_token': access_token['oauth_token'],
        'oauth_token_secret': access_token['oauth_token_secret'],
        'created_at': datetime.datetime.utcnow(),
        'last_login_at': datetime.datetime.utcnow()
        }
    user_id = db.users.insert(db.user)

    zaffen.setUserIdCookie(user_id)
    session['user_id'] = user_id

    raise web.redirect('http://zaffen.com/')


class reader:
  def GET(self, path):

    if zaffen.initUserData() == False:
      return web.InternalError()

    #print "Fetching " + path
    print str(time.time()) + " Fetching " + urllib.unquote(path)
    print "web.ctx.query = " + web.ctx.query

    #pprint.pprint(web.ctx)

    #req = urllib2.Request("http://www.google.com/" + urllib.quote(urllib.unquote(path)) + web.ctx.query, None, zaffen.getAuthHeader())
    #f = urllib2.urlopen(req)
    #s = f.read()
    #f.close()

    consumer = oauth.Consumer(zaffen.getOauthKey(), zaffen.getOauthSecret())
    token = oauth.Token(zaffen.user['oauth_token'], zaffen.user['oauth_token_secret'])
    client = oauth.Client(consumer, token)

    resp, content = client.request("http://www.google.com/%s%s" % (urllib.quote(urllib.unquote(path)), web.ctx.query), 'GET')

    print str(time.time()) + " Fetch done."

    return content

class Zaffen:
  def getOauthKey(self):
    return 'zaffen.com'

  def getOauthSecret(self):
    return '+xt/YOq/jJ4N0QCOFZkBA1/X'

  def getGoogleReaderScope(self):
    return "http://www.google.com/reader/api"

  def getRequestTokenUrl(self):
    return "https://www.google.com/accounts/OAuthGetRequestToken?scope=%s" % zaffen.getGoogleReaderScope()

  def getAuthorizeUrl(self):
    return "https://www.google.com/accounts/OAuthAuthorizeToken"

  def getAuthorizeCallbackUrl(self):
    return "http://zaffen.com/authsub"

  def getAccessTokenUrl(self):
    return "https://www.google.com/accounts/OAuthGetAccessToken"

  def generateUserId(self):
    return ''.join(random.choice(string.letters) for x in range(30))

  def getDb(self):
    if hasattr(self, 'db') is False:
      self.__connectToDb()

    return self.db

  def initUserData(self):
    if set(("user_id")) <= set(session):
      user_id = session['user_id']
    else:
      user_id = web.cookies().get('user_id')
      self.setUserIdCookie(user_id)

    if user_id == None:
      return False

    db = zaffen.getDb()
    self.user = db.users.find_one({'_id': user_id})

    if self.user == None:
      return False

    return True

  def setUserIdCookie(self, user_id):
    # Cookie expires in 30 days (if user does not login)
    #
    web.setcookie('user_id', user_id, 2592000)

  def __connectToDb(self):
    self.db = Connection().zaffen




#####################
#    MAIN
#####################

# Main routing
#
urls = (
  '/(reader/api/.*)', 'reader',
  '/', 'index',
  '/login', 'login',
  '/authsub', 'authsub'
)
app = web.application(urls, globals())

render = web.template.render('templates/')

zaffen = Zaffen()


# session fix for duplicate sessions in debug mode
# from http://webpy.org/cookbook/session_with_reloader
#
if web.config.get('_session') is None:
  session = web.session.Session(app, web.session.DiskStore('sessions'), {'count': 0})
  web.config._session = session
else:
  session = web.config._session


if __name__ == "__main__":
  app.run()
