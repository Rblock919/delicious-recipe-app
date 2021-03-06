import chalk from 'chalk';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';
import recipes from './data/recipeData';
import users from './data/userData';

// const bcrypt = require('bcrypt');
// const recipes = require('./src/data/recipeData');
// const users = require('./src/data/userData');
// const newRecipes = require('./src/data/newRecipeData');

// TODO: implement seeding for db-users
// mongo refers to mongo docker container name
MongoClient.connect(
  'mongo',
  { useNewUrlParser: true, useUnifiedTopology: true },
  async (err, client) => {
    if (err) {
      console.log(`ERR CONNECTING TO DB: ${chalk.red.bold.underline(err)}`);
    } else {
      try {
        const db = client.db('recipeApp');

        // seed recipes
        const recipeCollection = db.collection('recipes');
        await recipeCollection.insertMany(recipes);
        console.log(chalk.green('successfully seeded recipes!'));

        // seed users
        for (const user of users) {
          user.password = await bcrypt.hash(user.password, 12);
        }
        const userCollection = db.collection('users');
        await userCollection.insertMany(users);
        console.log(chalk.green('successfully seeded users!'));

        // close client
        await client.close(false);
      } catch (error) {
        console.log(`err seeding db: ${error}`);
      }
    }
  }
);
