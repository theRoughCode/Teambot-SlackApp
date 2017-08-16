const routes = require('express').Router();
const bot = require('../src/bot');
const bodyParser = require('body-parser');

routes.use(bodyParser.json());  // support JSON-encoded bodies
routes.use(bodyParser.urlencoded({ extended: true }));  // support URL-encoded bodies

// send custom msg
routes.get('/msg/:msg', function(req, res) {
  bot.sendMsg(req.params.msg);
  res.status(200);
  res.send();
});

// welcome message
routes.post('/start', function(req, res) {
  res.status(200);
  bot.welcome(req.body, msg => res.send(msg));
});
/*
routes.post('/post', function(req, res) {
  /* token, team_id, team_domain, channel_id
  channel_name, user_id, user_name
  command=/ , text, response_url
  bot.parseMsg(req.body.text);
  res.status(200);
  res.send();
});*/

// help
routes.post('/help', function(req, res) {
  res.status(200);
  bot.helpMsg(msg => {
    msg.response_type = "ephemeral";
    res.send(msg);
  });
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
  bot.parseIMsg(req.body, msg => res.send(msg));
});

// Receive events from Event application
routes.post('/events', function(req, res) {
  res.status(200);
  bot.parseEvent(req.body, msg => res.send(msg));
})

// display listed teams or members
routes.post('/list', function(req, res) {
  /* token, team_id, team_domain, channel_id
  channel_name, user_id, user_name
  command=/ , text, response_url*/
  res.status(200);
  bot.list(req.body, msg => res.send(msg));
});

// display personal info
routes.post('/display', function(req, res) {
  /* token, team_id, team_domain, channel_id
  channel_name, user_id, user_name
  command=/ , text, response_url*/
  res.status(200);
  bot.display(req.body.user_id, msg => res.send(msg));
});

// edit skills
routes.post('/skills', function(req, res) {
  /* token, team_id, team_domain, channel_id
  channel_name, user_id, user_name
  command=/ , text, response_url*/
  res.status(200);
  bot.createSkills(req.body, msg => res.send(msg));
})



module.exports = routes;
