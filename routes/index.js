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

// slash commands
routes.post('/slash', function(req, res) {
  /* token, team_id, team_domain, channel_id
  channel_name, user_id, user_name
  command=/ , text, response_url*/
  res.status(200);
  bot.parseCommands(req.body, msg => res.send(msg));
});

// interactive messages
routes.post('/interact', function(req, res) {
  console.log(req.body.message_ts);
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
  /*
  {"token","team_id","api_app_id",
  "event":
    {"type","user","item":
      {"type","channel","ts"},
    "reaction","item_user","event_ts"},
  "type","authed_users":[],"event_id","event_time"}
  */
  res.status(200);
  bot.parseEvent(req.body, msg => res.send(msg));
})


module.exports = routes;
