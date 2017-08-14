const routes = require('express').Router();
const data = require('../src/data');
const bot = require('../src/bot');
const bodyParser = require('body-parser');

routes.use(bodyParser.json());  // support JSON-encoded bodies
routes.use(bodyParser.urlencoded({ extended: true }));  // support URL-encoded bodies

routes.get('/', function(req, res){
  bot.welcome();
  res.status(200);
  res.send();
})

// send custom msg
routes.get('/msg/:msg', function(req, res) {
  bot.sendMsg(req.params.msg);
  res.status(200);
  res.send();
});

// welcome message
routes.post('/start', function(req, res) {
  bot.welcome(req.body.user_name);
  res.status(200);
  res.send();
});

routes.get('/start', function(req, res) {
  bot.welcome();
  res.status(200);
  res.send();
});

routes.post('/post', function(req, res) {
  /* token, team_id, team_domain, channel_id
  channel_name, user_id, user_name
  command=/ , text, response_url*/
  bot.parseMsg(req.body.text);
  res.status(200);
  res.send();
});

// interactive messages
routes.post('/interact', function(req, res) {
  res.status(200);
  bot.parseIMsg(req.body, msg => {
    res.send({
      text: msg;  // msg to replace original
    });
  });
});



module.exports = routes;
