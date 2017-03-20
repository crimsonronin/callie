'use strict';

// I use dotenv to manage config vars. remove below if you do not.
require('dotenv').config();


const CountdownBot = require('../lib/countdown'),
		cities = require('../data/cities'),
		mongoose = require('mongoose'),
		router = require('../router'),
		Bot = require('../lib/models/bot'),
		_ = require('lodash'),
		Countdown = require('../lib/models/countdown'),
		express = require('express'),
		app = express();

function isTestMode() {
	return process.env.NODE_ENV === 'test_env';
}

mongoose.Promise = require('bluebird');
const prodDB = `mongodb://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}:@jello.modulusmongo.net:27017/t2ipixUp`;
const databaseUrl = isTestMode() ? `mongodb://localhost/countdown-test` : prodDB;

mongoose.connect(databaseUrl);

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function() {
  console.log(`connected to DB in ${isTestMode() ? 'test mode' : 'live mode'}`);
});

app.use("/public", express.static(__dirname));

app.listen(process.env.PORT || 1337, function(){
  console.log(`Express server listening on port ${this.address().port} in %s mode`);
});

console.log(`Your server is running on port 1337.`);
router(app, db);

if (isTestMode()) {
	Bot.findOneAndRemove({userId: 'testbotkey'}).then(function() {
		console.log(process.env.TEST_BOT_KEY, process.env.TEST_TEAM_ID);
		const bot = new Bot({
			botAccessToken: process.env.TEST_BOT_KEY,
			userId: 'testbotkey',
			teamId: process.env.TEST_TEAM_ID
		});

		bot.save().then(function (bot) {
			console.log('bot', bot);
			const countdownBot = new CountdownBot({
				token: process.env.TEST_BOT_KEY,
				db: db,
				name: 'callietest'
			});
			countdownBot.run();
		});
	});
} else {
	Bot.find({}).then(function (bots) {
		_.each(bots, function(bot) {
			var bootUpBot = new CountdownBot({
				token: bot.botAccessToken,
				db: db,
				name: 'callie'
			});

			bootUpBot.run();

			Countdown.find({botId: bot.botAccessToken}).then(function(countdown) {
				if (_.get(countdown, 'schedule.active')) {
					bootUpBot.handleNewChronJob(countdown);
				}
			}).catch(function(err) {
				console.log(err, bot.botAccessToken);
			});
		});
	});

}

