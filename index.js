const cool = require('cool-ascii-faces');
const express = require('express')
const bodyParser = require('body-parser');
const path = require('path')
const PORT = process.env.PORT || 5000

const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// By default, the client will authenticate using the service account file
// specified by the GOOGLE_APPLICATION_CREDENTIALS environment variable and use
// the project specified by the GOOGLE_CLOUD_PROJECT environment variable. See
// https://github.com/GoogleCloudPlatform/google-cloud-node/blob/master/docs/authentication.md
// These environment variables are set automatically on Google App Engine
const Firestore = require('@google-cloud/firestore');
const firestore = new Firestore({
  projectId: 'quiz-1-map-distance-quiz',
  keyFilename: './keyfile.json',
});

express()
  .use(express.static(path.join(__dirname, 'public')))
  .use(bodyParser.urlencoded({ extended: true }))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .get('/robots.txt', function (req, res) {
    res.type('text/plain');
    res.send("User-agent: *\nDisallow: /");
  })
  .get('/cool', (req, res) => res.send(cool()))
  .get('/times', (req, res) => res.send(showTimes()))
  .get('/', (req, res) => res.render('pages/index'))
  .get('/voices', (req, res) => res.render('pages/voices'))
  .get('/create-new-game', (req, res) => res.render('pages/create-new-game'))
  .get('/api/get-game-details', async (req, res) => {
    console.log('Got API GET GAME query:', req.query);
    var gameId = req.query.gameId;
    console.log('gameId:', gameId);
    try {
      // get the initial questions
      const questionsDoc = await firestore.collection("games_" + gameId).doc('_questions').get();
      console.log('Got DB results:', questionsDoc.data());
      res.send(questionsDoc.data().locations);
      //res.sendStatus(200);
      //res.render('pages/play', results );
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/api/get-player-answers', async (req, res) => {
    console.log('Got API GET PLAYER ANSWERS query:', req.query);
    var gameId = req.query.gameId;
    var name = req.query.name;
    console.log('gameId:', gameId);
    console.log('name:', name);
    try {
      // get the player results
      const resultsDBData = await firestore.collection("games_" + gameId).where('resultUser', '=', name).get();
      //console.log('Got DB results:', resultsData);
      var results = {}
      resultsDBData.forEach((doc) => {
        if (doc.id != "_questions") {
          results[doc.data().resultId] = doc.data();
          //console.log('Added Result' + doc.data().resultId);
        }
      });
      //console.log('Got results:', results);
      res.send(results);
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/play-game', async (req, res) => {
    var gameId = req.query.gameId;
    console.log('Got GET gameId:', gameId);
    if (!gameId) { gameId = -1; }
    try {
      var locations = {myLocations: [], myLocationCoords: []};
      const doc = await firestore.collection("games_" + gameId).doc('_questions').get();
      if (doc.data()) {
        locations = doc.data().locations;
      }
      res.render('pages/play-game', {gameId: gameId, locations: locations });
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
    })
  .get('/convert-game', async (req, res) => {
    var gameId = req.query.gameId;
    console.log('Got GET gameId:', gameId);
    try {
      const client = await pool.connect();
      const result = await client.query(`SELECT locations FROM games WHERE gameid='${gameId}'`);
      //const results = { 'results': (result) ? result.rows : null};
      const results = { 'gameId': gameId, 'results': result.rows};
      console.log('Got DB results:', results.results[0].locations);

      var newBody = {};
      newBody.gameId = gameId;
      newBody.timestamp = results.results[0].locations.timestamp;
      newBody.creatorName = results.results[0].locations.creatorName;
      var myLocations = [];
      var myLocationCoords = [];
      for (i = 0; i < 20; i++) {
        var location = results.results[0].locations["location"+i];
        var locationCoords = results.results[0].locations["location"+i+"coords"];
        if (location) {
          myLocations.push(location);
          myLocationCoords.push(locationCoords);
        }
      }
      if (myLocations.length > 0) {
        newBody.myLocations = myLocations;
        newBody.myLocationCoords = myLocationCoords;
        var locations = JSON.stringify(newBody);
        console.log("Writing to DB: " + locations);
        //const client = await pool.connect();
        const writeresult = await client.query(`UPDATE games SET locations = '${locations}' WHERE gameid = '${gameId}'`);
        const writeresults = { 'gameId': gameId, 'body': locations};
        console.log("Done: " + writeresult);
        res.render('pages/share-game', writeresults );
      } else {
        console.log("ERROR - No locations found for id " + gameid);
      }
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  // .get('/view-results', async (req, res) => {
  //   console.log('Got GET query:', req.query);
  //   var gameId = req.query.gameId;
  //   var gameName = req.query.gameName;
  //   console.log('gameId:', gameId);
  //   console.log('gameName:', gameName);
  //   try {
  //     const client = await pool.connect();
  //     const result = await client.query(`INSERT INTO games(gameid, gamecode) VALUES ('${gameId}', '${gameName}')`);
  //     const results = { 'results': (result) ? result.rows : null};
  //     console.log('Got DB results:', results);
  //     //res.sendStatus(200);
  //     res.render('pages/play', results );
  //     //client.release();
  //   } catch (err) {
  //     console.error(err);
  //     res.send("Error " + err);
  //   }
  // })
  .post('/save-game', async (req, res) => {
    console.log('Got POST body:', req.body);
    var gameId = req.body.gameId;
    req.body.timestamp = new Date().toString();
    var locations = req.body;
    try {
      const gamedetails_new = { gameId: gameId, locations: locations };
      const docRef = firestore.collection("games_" + gameId).doc("_questions");
      await docRef.set(gamedetails_new);
      //console.log('Created DB file');

      //res.sendStatus(200);
      const results = { 'gameId': gameId, 'body': req.body};
      res.render('pages/share-game', results );
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/save-result', async (req, res) => {
    console.log('Got GET query:', req.query);
    var gameId = req.query.gameId;
    var resultUser = req.query.resultuser;
    var resultLocationName = req.query.resultlocationname;
    var resultCoordinates = req.query.resultcoordinates;
    var resultId = resultUser + "_" + resultLocationName + "_" + gameId;
    try {
      const gameResults = { resultId: resultId, gameId: gameId, resultUser: resultUser, resultLocationName: resultLocationName, resultCoordinates: resultCoordinates };
      const docRef = firestore.collection("games_" + gameId).doc("results_" + resultUser + "_" + resultLocationName);
      await docRef.set(gameResults);
      //res.sendStatus(200);
      res.json({'result': 'OK'})
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/show-results', async (req, res) => {
    var gameId = req.query.gameId;
    console.log('/show-results Got GET gameId:', gameId);
    if (!gameId) { gameId = -1; }
    try {
      // get the initial questions
      var locations = {myLocations: [], myLocationCoords: []};
      const questionsDoc = await firestore.collection("games_" + gameId).doc('_questions').get();
      if (questionsDoc.data()) {
        locations = questionsDoc.data().locations;
      }
      // get the player results
      const resultsDBData = await firestore.collection("games_" + gameId).where('gameId', '=', gameId).get();
      //console.log('Got DB results:', resultsData);
      var results = {}
      resultsDBData.forEach((doc) => {
        if (doc.id != "_questions") {
          results[doc.data().resultId] = doc.data();
          //console.log('Added Result' + doc.data().resultId);
        }
      });

      var gameData = { gameId: gameId, locations: locations, resultsData: results };
      res.render('pages/show-results', gameData );
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
    })
  .listen(PORT, () => console.log(`Listening on ${ PORT }`))

showTimes = () => {
  let result = '';
  const times = process.env.TIMES || 5;
  for (i = 0; i < times; i++) {
    result += i + ' ';
  }
  return result;
}
