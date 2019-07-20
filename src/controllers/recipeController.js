//var MongoClient = require('mongodb').MongoClient;
const jwt = require('jwt-simple');
const bcrypt = require('bcrypt-nodejs');
const chalk = require('chalk');
const objectId = require('mongodb').ObjectId;
const authConfig = require('../config/auth/authConfig');

const recipeController = (Recipe, newRecipe) => {

    //Handle forwarding requests to main page for users that aren't logged in
    // eslint-disable-next-line consistent-return
    var middleware = (req, res, next) => {

        if (!req.header('Authorization')) {
            // console.log('NO AUTH TOKEN FOUND IN NODE MIDDLEWARE');
            return res.status(401).send({ErrMessage: 'Unauthorized. Missing Auth Header'});
        }

        let token = req.header('Authorization').split(' ')[1];

        if (token !== 'null') {

            // console.log('TOKEN FOUND IN HEADER');
            let payload = jwt.decode(token, authConfig.secret);
            // console.log('payload: ' + JSON.stringify(payload));

            if (!payload) {
                console.log('auth header invalid');
                return res.status(401).send({ErrMessage: 'Unauthorized. Auth Header Invalid'});
            } else {
                // console.log('setting userId in req');
                req.userId = payload.sub;
                next();
            }

        } else {
            console.log('NO TOKEN FOUND IN MW');
            res.status(401).send({ErrMessage: 'Unauthorized. Missing Token'});
        }

        // console.log('TOKEN IN RECIPE CONT MIDDLEWARE: ' + token);

        // if (!req.user) {
            // console.log('User not logged in');
            // res.redirect('/');
            // return;
        // } else {
            // next();
        // }
    };

    var getIndex = (req, res) => {
        var query = {};

        Recipe.find(query, (err, recipes) => {
            if (err) {
                console.log(chalk.red(err));
                res.sendStatus(500);
            }
            //res.status(200);
            //console.log('Recipes object: ' + recipes);
            res.status(200).send(recipes);
        });
    };

    var getById = (req, res) => {
        var id;
        var query;
        // for testing spinner icon & route animations in front end
        // setTimeout(() => {
            // var id = new objectId(req.params.id);
            // var query = {_id: id};

            // Recipe.findOne(query, (err, recipe) => {
                // if (err) {
                    // console.log(err);
                    // res.sendStatus(500);
                // }
                // res.status(200).send(recipe);
            // });
        // }, 1000)
        try {
            id = new objectId(req.params.id);
            query = {_id: id};

            Recipe.findOne(query, (err, recipe) => {
                if (err) {
                    console.log(err);
                    res.sendStatus(500);
                }
                res.status(200).send(recipe);
            });
        } catch (error) {
            console.log(chalk.red(`Error making objectId or retrieve recipe: ${error}`));
            res.status(400).send({ErrMessage: 'Bad Request'});
        }

    };

    var addRecipe = async (req, res) => {
        var id;
        var query;
        var recipeToSave;
        var proceed = true;

        try {
            id = new objectId(req.body.approvalId);
            query = {_id: id};
        } catch (error) {
            console.log(chalk.red(error));
            proceed = false;
        }

        // var returnId;
        if (proceed) {
            recipeToSave = new Recipe({
                title: req.body.recipe.title,
                producer: req.body.recipe.producer,
                ingredients: [],
                preCook: [],
                steps: req.body.recipe.steps,
                nutritionValues: req.body.recipe.nutritionValues,
                favoriters: [],
                raters: {},
                imgDir: req.body.recipe.imgDir
            });

            req.body.recipe.ingredients.forEach(element => {
                recipeToSave.ingredients.push(element.name + ' | ' + element.amount);
            });
            if (req.body.recipe.producer === 'Hello Fresh' || req.body.recipe.producer === 'Home Chef') {
                req.body.recipe.preCook.forEach(element => {
                    recipeToSave.preCook.push(element.body);
                });
            };

            await newRecipe.deleteOne(query, function (err) {
                if (err) {
                    console.log(chalk.red('ERROR DELETING RECIPE FROM APPROVAL LIST: \n' + err));
                } else {
                    // res.status(201).send({id: returnId});
                }
            });

            await recipeToSave.save(function (err, createdRecipe) {
                if (err) {
                    console.log(chalk.red(err));
                    res.sendStatus(500);
                } else {
                    console.log(chalk.green('successfully saved new recipe'));
                    // res.sendStatus(201);
                    console.log('ReturnId: ' + createdRecipe._id);
                    res.status(201).send({id: createdRecipe._id});
                }
            });
        }

    };

    var updateRecipe = (req, res) => {
        var id;
        var query;
        var recipeData;

        try {
            id = new objectId(req.body._id);
            query = {_id: id};
            recipeData = assembleRecipeData(req);

            Recipe.findOneAndUpdate(query, recipeData, function (err, doc) {
                if (err) {
                    console.log(chalk.red(err));
                    res.sendStatus(500);
                } else {
                    console.log(chalk.green('recipe successfully updated'));
                    res.sendStatus(200);
                }
                // console.log('doc: ' + doc);
            });
        } catch (error) {
            console.log(chalk.red(error));
            res.sendStatus(500);
        }

    };

    var deleteRecipe = (req, res) => {
        var id;
        var query;

        try {
            id = new objectId(req.params.id);
            query = {_id: id};

            Recipe.deleteOne(query, function (err) {
                if (err) {
                    console.log(chalk.red('ERROR: ' + err));
                } else {
                    res.sendStatus(200);
                }
            });
        } catch (error) {
            console.log(chalk.red(error));
            res.sendStatus(500);
        }

    }

    var favorite = (req, res) => {
        var prevFavoriters = req.body.recipe.favoriters;
        var id;
        var query;
        var updatedFavoriters;
        var addingFav = req.body.favoriting;
        var proceed = true;

        try {
            id = new objectId(req.body.recipe._id);
            query = {_id: id};
        } catch (error) {
            console.log(chalk.red(error));
            proceed = false;
        }

        if (proceed === true) {
            if (addingFav) { // user is favoriting recipe
                prevFavoriters.push(req.userId);
            } else { // user is unfavoriting recipe
                prevFavoriters = prevFavoriters.filter(uId => uId !== '' + req.userId)
            }

            updatedFavoriters = {favoriters: prevFavoriters};
            Recipe.findOneAndUpdate(query, updatedFavoriters, function (err, doc) {
                if (err) {
                    console.log(chalk.red(err));
                    res.sendStatus(500);
                }
                // console.log('doc: ' + JSON.stringify(doc));
                res.sendStatus(200);
            });
        } else {
            res.sendStatus(500);
        }

    };

    var rateRecipe = (req, res) => {
        var recipeId;
        var query;
        var newRaters;
        var updatedRaters;

        try {
            recipeId = new objectId(req.body._id);
            query = {_id: recipeId};

            newRaters = req.body.raters;
            updatedRaters = {raters: newRaters};

            Recipe.findOneAndUpdate(query, updatedRaters, function (err, doc) {
                if (err) {
                    console.log(chalk.red(err));
                    res.sendStatus(500);
                }
                // console.log('doc: ' + doc);
                res.sendStatus(200);
            });
        } catch (error) {
            console.log(chalk.red(error));
            res.sendStatus(500);
        }

    };

    var submitForApproval = (req, res) => {

        var recipeData = assembleRecipeData(req);
        var recipeToSave = new newRecipe({
            title: recipeData.title,
            producer: recipeData.producer,
            ingredients: recipeData.ingredients,
            preCook: recipeData.preCook,
            steps: recipeData.steps,
            nutritionValues: recipeData.nutritionValues,
            favoriters: [],
            raters: {},
            imgDir: recipeData.imgDir
        });

        console.log('recipeToSave data in addRecipe: ' + JSON.stringify(recipeToSave));
        // res.sendStatus(201);
        // return;

        recipeToSave.save(function (err, createdRecipe) {
            if (err) {
                console.log(chalk.red(err));
                res.sendStatus(500);
            } else {
                console.log(chalk.green('successfully saved new recipe'));
                // res.sendStatus(201);
                res.status(201).send({id: createdRecipe._id});
            }
        });

    };

    return {
        middleware,
        getIndex,
        getById,
        addRecipe,
        updateRecipe,
        deleteRecipe,
        submitForApproval,
        rateRecipe,
        favorite
    };
}

module.exports = recipeController;

function assembleRecipeData(req) {

    var recipeData = {
        title: req.body.title,
        producer: req.body.producer,
        ingredients: [],
        preCook: [],
        steps: req.body.steps,
        nutritionValues: req.body.nutritionValues,
        imgDir: req.body.imgDir,
        raters: req.body.raters,
        favoriters: req.body.favoriters
    }
    console.log('req.body.steps in assembleRecipeData: ' + JSON.stringify(req.body.steps));

    req.body.ingredients.forEach(element => {
        recipeData.ingredients.push(element.name + ' | ' + element.amount);
    });
    if (recipeData.producer === 'Hello Fresh' || recipeData.producer === 'Home Chef') {
        req.body.preCook.forEach(element => {
            recipeData.preCook.push(element.body);
        });
    }

    return recipeData;

}