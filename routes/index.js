const routes = require('express').Router();
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
  bot.welcome(req.body);
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
  /*
  {
    "actions": [{"name","type","value"/"selected_options:[{"value"}]"}],
    "callback_id",
    "team":{"id","domain"},
    "channel":{"id","name"},
    "user":{"id","name"},
    "action_ts",
    "message_ts",
    "attachment_id",
    "token",
    "is_app_unfurl",
    "original_message",
    "response_url",
    "trigger_id"
  }
  */
  res.status(200);
  bot.parseIMsg(req.body, msg => {
    res.send(msg);
  });
});



module.exports = routes;
