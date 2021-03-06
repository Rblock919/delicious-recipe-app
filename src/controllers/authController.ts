import chalk from 'chalk';
import { ObjectId } from 'mongodb';
import jwt from 'jsonwebtoken';
import authConfig from '../config/auth/authConfig';

const authController = (User, Login) => {
  const signUp = async (req, res) => {
    const newUser = new User({
      username: escape(req.body.username),
      password: req.body.password,
      isAdmin: false,
    });

    try {
      const createdUser = await newUser.save();
      const payload = { sub: createdUser._id };
      const token = await jwt.sign(payload, authConfig.tokenSecret, {
        expiresIn: 7 * 24 * 60 * 60 * 1000,
      });
      // const cookieToken = await jwt.sign(payload, authConfig.cookieSecret, {expiresIn: ((7 * 24 * 60 * 60) * 1000)});
      const user = {
        _id: createdUser._id,
        username: createdUser.username,
        password: createdUser.password,
        isAdmin: false,
      };

      return res.status(201).send({ user, token });

      // req.session.login(user, (err) => {
      //   // newly updated req.session is available here. If you try to access below the async nature will give you old req.session
      //   if (err) {
      //     console.error('error saving user to session');
      //     return res.status(500).send({ErrMessage: 'Error creating session for newly created user.'});
      //   } else {
      //     res.status(201).cookie('tkn', cookieToken, {
      //       path: '/api',
      //       httpOnly: true,
      //       secure: JSON.parse(process.env.SECURE_COOKIES),
      //       sameSite: true,
      //       maxAge: ((7 * 24 * 60 * 60) * 1000) // 1 week
      //     }).send({token, user});
      //   }
      // });
    } catch (err) {
      console.log(chalk.red(err));
      if (err.code === 11000) {
        return res.status(409).send({ ErrMessage: 'Username Already Exists' });
      }
      return res.status(500).send({ ErrMessage: 'Error creating new user.' });
    }
  };

  const signIn = async (req, res) => {
    console.log('in signin');
    // slow down brute force login attempts
    const delayResponse = response => {
      setTimeout(() => {
        response();
      }, 600);
    };

    // console.log('Remote Address: ' + req.connection.remoteAddress);

    const clientIp = req.connection.remoteAddress;
    const userData = req.body;
    const identityKey = `${userData.username}-${clientIp}`;

    if (await Login.inProgress(identityKey)) {
      return delayResponse(() =>
        res.status(500).send({ ErrMessage: 'Login already in progress' })
      );
    }

    if (!(await Login.canAuthenticate(identityKey))) {
      await Login.endProgress(identityKey);
      return delayResponse(() => {
        res.status(500).send({
          ErrMessage:
            'The account is temporarily locked out due to excessive number of login attempts. Please wait a few minutes',
        });
      });
    }

    const query = { username: escape(userData.username) };
    let payload = {};

    const existingUser = await User.findOne(query, '-__v').exec();

    let validPassword;
    if (existingUser) {
      validPassword = await existingUser.passwordIsValid(userData.password);
    }

    if (existingUser && validPassword) {
      payload = { sub: existingUser._id };
      const token = await jwt.sign(payload, authConfig.tokenSecret, {
        expiresIn: 7 * 24 * 60 * 60 * 1000,
      });
      // const cookieToken = await jwt.sign(payload, authConfig.cookieSecret, {expiresIn: ((7 * 24 * 60 * 60) * 1000)});
      const user = {
        _id: existingUser._id,
        username: existingUser.username,
        isAdmin: existingUser.isAdmin,
      };

      // req.session.login(user, (err) => {
      //   if (err) {
      //     console.error('error saving user to session');
      //   }
      //   // newly updated req.session is available here. If you try to access below the async nature will give you old req.session
      // });

      await Login.successfulLoginAttempt(identityKey);

      return delayResponse(() => {
        res.status(200).send({ user, token });
        // res.status(200).cookie('tkn', cookieToken, {
        //   // path: '/',
        //   path: '/api',
        //   httpOnly: true,
        //   secure: JSON.parse(process.env.SECURE_COOKIES),
        //   sameSite: false,
        //   maxAge: ((7 * 24 * 60 * 60) * 1000) // 1 week
        // }).send({user: user, token: token});
      });
    }
    await Login.failedLoginAttempt(identityKey);
    return delayResponse(() =>
      res.status(401).send({ ErrMessage: 'Invalid username or password' })
    );
  };

  const signOut = (req, res) => {
    // TODO: figure out if I still need this method in this api
    return res.sendStatus(200);
    // req.session.logout((err) => {
    //   if (err) {
    //     console.error(chalk.red(`Error destroying session: ${err}`));
    //     return res.status(500).send({ErrMessage: 'Error destroying session'});
    //   } else {
    //     return res.sendStatus(200);
    //   }
    // });
  };

  const getUserData = async (req, res) => {
    let userId;
    let reqId;
    let payload;
    // let cookiePayload;
    // let sessionId;

    // console.log(`req headers: ${JSON.stringify(req.headers)}`);

    if (!req.header('Authorization')) {
      return res
        .status(401)
        .send({ ErrMessage: 'Unauthorized. Missing Auth Header' });
    }

    const token = req.header('Authorization').split(' ')[1];
    // const { tkn, id } = req.cookies;

    // if (!!id) {
    //   sessionId = id.split('.')[0].slice(2);
    //   if (sessionId !== req.session.id) {
    //     return res.status(401).send({ErrMessage: 'Invalid authorization cookie'})
    //   }
    // } else {
    //   return res.status(401).send({ErrMessage: 'Missing authorization cookie'})
    // }

    if (token !== 'null') {
      try {
        payload = await jwt.verify(token, authConfig.tokenSecret);
        // cookiePayload = await jwt.verify(tkn, authConfig.cookieSecret);
      } catch (error) {
        console.error(error);
        return res.status(500).send({ ErrMessage: 'Error validating tokens' });
      }

      if (!payload) {
        console.log('auth header invalid');
        return res
          .status(401)
          .send({ ErrMessage: 'Unauthorized. Auth Header Invalid' });
      }
      userId = payload.sub;
      // userId = cookiePayload.sub;

      try {
        reqId = new ObjectId(userId);
      } catch (error) {
        console.log(chalk.red(`err parsing user id into objectId: ${error}`));
      }
    } else {
      console.log('no auth token set');
      return res
        .status(401)
        .send({ ErrMessage: 'Unauthorized. Missing Token' });
    }

    try {
      const user = await User.findById(reqId, '-__v -password');
      if (user) {
        return res.status(200).send({ user });
      }
      return res.status(404).send({ ErrMessage: 'User Not Found' });
    } catch (err) {
      console.log(`Error: ${err}`);
      return res.sendStatus(500);
    }
  };

  return {
    signUp,
    signIn,
    signOut,
    getUserData,
  };
};

export default authController;
