import web
import urllib
import urllib2
import re
        
urls = (
  '/(reader/api/.*)', 'reader',
  '/', 'index',
  '/login', 'login'
)
app = web.application(urls, globals())

render = web.template.render('templates/')

# session fix for duplicate sessions in debug mode
# from http://webpy.org/cookbook/session_with_reloader
#
if web.config.get('_session') is None:
  session = web.session.Session(app, web.session.DiskStore('sessions'), {'count': 0})
  web.config._session = session
else:
  session = web.config._session

class index:
  def GET(self):
    f = open('./static/index.html')
    s = f.read()
    f.close()
    return s

class login:
  def GET(self):

    if 'auth_token' in session:
      return 'ok'

    #post_data = web.data()
    values = {'Email': 'paul.leitmanis@gmail.com', 'Passwd': 'p41nf0l-', 'service': 'reader', 'accountType': 'HOSTED_OR_GOOGLE', 'source': 'ZaffenCo-Zaffen-1'}
    url = "https://www.google.com/accounts/ClientLogin"
    data = urllib.urlencode(values)
    req = urllib2.Request(url, data)
    response = urllib2.urlopen(req)
    s = response.read()
    response.close()
    auth_token = re.search('Auth=(.*)',s, re.I|re.M|re.S).group(1)
    if auth_token:
      session['auth_token'] = auth_token
    else:
      return 'fail'

    print 'new auth token', session

    return 'ok'

class reader:
  def GET(self, path):

    print "Fetching " + path + web.ctx.query

    req = urllib2.Request("http://www.google.com/" + path + web.ctx.query, None, zaffen.getAuthHeader())
    f = urllib2.urlopen(req)
    s = f.read()
    f.close()
    return s

class zaffen:
  @staticmethod
  def getAuthHeader():
    return {'Authorization': "GoogleLogin auth=" + session['auth_token']}


if __name__ == "__main__":
  app.run()
