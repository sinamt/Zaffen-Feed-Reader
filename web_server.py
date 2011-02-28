import web
import urllib
import urllib2
import re
import time
        
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

    #path = '/reader/api/0/stream/contents/feed/http%3A%2F%2Fen.wikipedia.org%2Fw%2Findex.php%3Ftitle%3DSpecial%3ANewPages%26feed%3Drss'
    #print "Fetching " + path
    print str(time.time()) + " Fetching " + urllib.unquote(path)
    #print "web.ctx.path = " + web.ctx.path
    print "web.ctx.query = " + web.ctx.query

    #pprint.pprint(web.ctx)

    req = urllib2.Request("http://www.google.com/" + urllib.quote(urllib.unquote(path)) + web.ctx.query, None, zaffen.getAuthHeader())
    f = urllib2.urlopen(req)
    s = f.read()
    f.close()

    print str(time.time()) + " Fetch done."

    return s

class zaffen:
  @staticmethod
  def getAuthHeader():
    return {'Authorization': "GoogleLogin auth=" + session['auth_token']}
    #return {'Authorization': "GoogleLogin auth=DQAAALoAAADou8sfWJw56Nkh5o2PEgA1d-f9_vzN9-VAadMruu7uBRPZmHosU70d21t8EfLQXnHqsrYTJqt0NrLWSv2MMaaJm4cR786V9UgFlHnpLkEpxRbKqW0ThGLaF6sPafkk7DfFmU6jOsv8LVIkQgjzz6Epm-oEXrNDbuWhZyRMY2G2J_sKv3DIsF_jcM3IonTfXC7acv8uq6yB-SrC8UOYXnTuIKA1k0qJIbcLjBw7N5i3dSAiw4rW3JWjwf_9sc8DkjE" }


if __name__ == "__main__":
  app.run()
