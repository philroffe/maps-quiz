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
      const client = await pool.connect();
      const result = await client.query(`SELECT locations FROM games WHERE gameid='${gameId}'`);
      const results = { 'results': (result) ? result.rows : null};
      console.log('Got DB results:', results.results[0].locations);
      res.send(results.results[0].locations);
      //res.sendStatus(200);
      //res.render('pages/play', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/play-game', async (req, res) => {
    var gameId = req.query.gameId;
    console.log('Got GET gameId:', gameId);
    try {
      const client = await pool.connect();
      const result = await client.query(`SELECT locations FROM games WHERE gameid='${gameId}'`);
      const results = { 'results': (result) ? result.rows : null};
      console.log('Got DB results:', results.results[0].locations);
      res.render('pages/play-game', results );
      client.release();
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
    var locations = JSON.stringify(req.body);
    try {
      const client = await pool.connect();
      const result = await client.query(`INSERT INTO games(gameid, locations) VALUES ('${gameId}', '${locations}')`);
      const results = { 'gameId': gameId, 'body': req.body};
      //res.sendStatus(200);
      res.render('pages/share-game', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/save-result', async (req, res) => {
    console.log('Got GET query:', req.query);
    var gameId = req.query.gameId;
    var resultuser = req.query.resultuser;
    var resultlocationname = req.query.resultlocationname;
    var resultcoordinates = req.query.resultcoordinates;
    var resultid = resultuser + "_" + resultlocationname + "_" + gameId;
    try {
      const client = await pool.connect();
      const result = await client.query(`INSERT INTO 
        gameresults(resultid, gameid, resultuser, resultlocationname, resultcoordinates) 
        VALUES ('${resultid}', '${gameId}', '${resultuser}', '${resultlocationname}', '${resultcoordinates}')
        ON CONFLICT (resultid) DO UPDATE 
          SET resultcoordinates = '${resultcoordinates}';`)
      const results = { 'results': (result) ? result.rows : null};
      console.log('Got DB results:', results);
      //res.sendStatus(200);
      res.json({'result': 'OK'})
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
  })
  .get('/show-results', async (req, res) => {
    var gameId = req.query.gameId;
    console.log('/show-results Got GET gameId:', gameId);
    try {
      const client = await pool.connect();
      const gamesDBResult = await client.query(`SELECT * FROM games WHERE gameid='${gameId}'`);
      const resultsDBResult = await client.query(`SELECT * FROM gameresults WHERE gameid='${gameId}'`);
      const results = { 'gamesDBResult': (gamesDBResult) ? gamesDBResult.rows : null,
        'resultsDBResult': (resultsDBResult) ? resultsDBResult.rows : null};
      //console.log('Got DB results:', results.results[0].locations);
      console.log('Got DB results:', results);
      res.render('pages/show-results', results );
      client.release();
    } catch (err) {
      console.error(err);
      res.send("Error " + err);
    }
    })
  .get('/show-results2', async (req, res) => {
    var gameId = req.query.gameId;
    console.log('/show-results2 Got GET gameId:', gameId);
    try {
      const client = await pool.connect();
      const gamesDBResult = await client.query(`SELECT * FROM games WHERE gameid='${gameId}'`);
      const resultsDBResult = await client.query(`SELECT * FROM gameresults WHERE gameid='${gameId}'`);
      const results = { 'gamesDBResult': (gamesDBResult) ? gamesDBResult.rows : null,
        'resultsDBResult': (resultsDBResult) ? resultsDBResult.rows : null};
      //console.log('Got DB results:', results.results[0].locations);
      console.log('Got DB results:', results);
      res.render('pages/show-results2', results );
      client.release();
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
