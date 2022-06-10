require('dotenv').config();
const express = require('express');
const router = express.Router();
const fs = require('fs');
const script = require('./script.js')
const arco = require('./arco.js')
const mongoose = require('mongoose');
const UserSchema = require('../models/UserSchema');
const SCSchema = require('../models/SCSchema');
const NotifSchema = require('../models/NotifSchema');
const nodemailer = require('nodemailer');
const moment = require('moment');
var Session = {};
const process = require('process');

//Mailing
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIN_USER,
    pass: process.env.MAIN_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});
// mongoo options
const MongooOptions = {
    useUnifiedTopology: true,
    UseNewUrlParser: true,
};

const getAllUsers = async () => {
    let user = [];
    await mongoose.connect(
    process.env.MONGO_URI,
    {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
    }
    ).then(async () => {
        user = await UserSchema.find();
    }).catch(err => { });

    return user;
}

const getSCInfo = async () => {
    let user = [];
    await mongoose.connect(
    process.env.MONGO_URI,
    {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
    }
    ).then(async () => {
        user = await SCSchema.find();
    }).catch(err => { });

    return user[0];
}

// get notifications
const getNotifs = async () => {
    const Limit = 8;
    let notifs = [];
    await mongoose.connect(
    process.env.MONGO_URI,
    {
        useUnifiedTopology: true,
        UseNewUrlParser: true,
    }
    ).then(async () => {
        allNotifs = await NotifSchema.find();
        notifs = await NotifSchema.find().sort('-creation').limit(Limit);
        notifs.forEach(async e => {e.moment = moment(e.creation).fromNow()});
        if (allNotifs.length > Limit) {
            // supprimer les autres notifications
            await NotifSchema.deleteMany();
            // insert many 
            await NotifSchema.insertMany(notifs);
        }
        notifs.forEach(n => {
            if (n.category === 'salary calculation' || n.category === 'arco') {
                n.file = n.link;
                n.exists = true;
                if (!fs.existsSync('uploads/'+n.link)) {
                    n.exists = false;
                    n.link = '#';
                }
            }
        })
    }).catch(err => { });

    return notifs;
}

/* Check the session while posting */
const checkSessionInPost = (req, res, next) => {
    if (!req.session.userId) {
        return res.send({
            status: false,
            icon: 'warning',
            message: 'Your session has expired! Please login and try again.'
        });
    } else {
        next();
    }
}


// redirect to login
const redirectLogin = (req, res, next) => {
    if (req.session.userId) {
        if (!req.session.userId.access)
            return (res.redirect('/login'));
        return next();
    } else {
        return res.redirect('/login');
    }
}

const checkType = (req, res, next) => {
    if (req.session.userId.usertype !== 'admin') {
        backURL=req.header('Referer') || '/';
        res.redirect(backURL);
    } else {
        next();
    }
}

// redirect to home
const redirectHome = (req, res, next) => {
    if (!req.session.userId) {
        next();
    } else {
        res.redirect('/home');
    }
}

// Navigation 
router.route('').get((req, res) => {
    return res.redirect('/home');
});

// LOGOUT
router.route('/logout').get(redirectLogin, (req, res) => {
    req.session = null;
    return res.redirect('/login');
});

// FORGOT
router.route('/forgot-password').get(redirectHome, (req, res) => {
    req.session.foundUser = null;
    return res.render('forgot', {login: true, year: new Date().getFullYear()});
});

// CODE
router.route('/enter-code').all(redirectHome, (req, res) => {
    const codeAuth = req.session.code;
    if (req.method === 'GET') {
        if (codeAuth) 
            return res.render('enter-code', {login: true, year: new Date().getFullYear()});
        else 
            return res.redirect('/forgot-password');
    } else {
        const {code} = req.body;
        if (code === codeAuth) {
            res.send({status: true});
        } else {
            res.send({status: false, message: 'You have entered an invalid code.'})
        }
    }
});

// NEW PASSWORD & SET A NEW PASSWORD
router.route('/new-password').all(redirectHome, (req, res) => {
    const foundUser = req.session.foundUser;
    if (req.method === 'GET') {
        if (foundUser)
            res.render('new-password', {login: true, year: new Date().getFullYear()});
        else 
            return res.redirect('/forgot-password');
    } else {
        mongoose.connect(
            process.env.MONGO_URI,
            {
                useUnifiedTopology: true,
                UseNewUrlParser: true,
            }
        ).then(async () => {
            const {password, keep} = req.body;
            foundUser.password = password;
            await UserSchema.findOneAndUpdate({email: foundUser.email}, foundUser);
            // if user checked the keep sign in
            if (keep === 'true') {
                req.session.userId = foundUser;
            }
            res.send({status: true});
        }).catch(err => {
            return res.send({
                status: false,
                target: 'database',
                message: err
            });
        });
    }
});


// CHECK USER NAME
router.route('/find-username').post(redirectHome, (req, res) => {
    const {username} = req.body;
    
    mongoose.connect(
        process.env.MONGO_URI,
        MongooOptions
    ).then(async () => {
        const result = await UserSchema.findOne({$or: [{username: username}, {email: username}]});
        // if result is not null
        if (result) {
            // generate random number code
            let random_code = script.randomnNumberCode();
            // set session number code
            req.session.code = random_code;
            // send email
            var mailOptions = {
                from: process.env.MAIN_USER,
                to: result.email,
                subject: "Validation code for Salary Calculation",
                html:
                    `<div style="padding: 8px; background-color: aliceblue;">
                    <center>
                    <h1>Salary Calculation Validation Code</h1>
                    <table border="1" style="background:white; width: 400px; border-color: #eee; padding: 8px;border-collapse: collapse;">
                        <tbody>
                            <tr>
                                <th style="text-align: left;  padding: 8px !important;">CODE:</th>
                                <td style="padding: 8px !important;">${random_code}</td>
                            </tr>
                        </tbody>
                    </table>
                    <br>
                    </center>
                </div>`,
            };
            await transporter.sendMail(mailOptions, function (error, info) {
                error ? console.log(error) : console.log(info);
                transporter.close();
            });
            req.session.foundUser = result;
            res.send({status: true})
        } else {
            res.send({
                status: false,
                target: 'username',
                message: 'This username or email is not found.'
            });
        }

    }).catch(err => {
        console.log(object);
        return res.send({
            status: false,
            target: 'database',
            message: err
        });
    });
});


// LOGIN 
router.route('/login').all(redirectHome, (req, res) => {
    if (req.method === 'GET') {
        return res.render('login', {login: true, year: new Date().getFullYear()});
    } else {
        mongoose.connect(
            process.env.MONGO_URI,
            {
                useUnifiedTopology: true,
                UseNewUrlParser: true,
            }
        ).then(async () => {
            let user = await {
                username: req.body.username,
                password: req.body.password,
            }
    
            // check username
            let find_user = await UserSchema.findOne({username: user.username});

            // if username found
            let data = [];
            if (find_user) {
                if (user.password !== find_user.password)
                data.push({
                    target: 'password',
                    message: 'Your password is wrong'
                });
                // check access
                if (!find_user.access) {
                    data.push({
                        target: 'access',
                        message: 'Sorry, your access is closed. Please, contact the admin.'
                    });
                }
            } else {
                data.push({
                    target: 'username',
                    message: 'The username doesn\'t exist.'
                });
            } 
    
            // if data is not empty
            if (data.length > 0) {
                res.send({
                    status: false,
                    data: data,
                });
            } else {
                req.session.userId = find_user;
                Session[user.username] = {};
                // set notif
                let notif = {
                    category: 'user',
                    description: 'A user was logging in',
                    creation: new Date()
                }
                await new NotifSchema(notif).save();
                
                // go to home
                res.send({
                    status: true,
                    username: user.username,
                    password: user.password,
                    message: 'Login with success!'
                });
            }
        }).catch(err => {
            console.log(err);
            res.send({
                target: 'database',
                status: false,
                message: 'Unable to connect the database.'
            });
        });
    }
});

/**
 * HOME Page.
 */
router.route('/home').get(redirectLogin, async (req, res) => {
    const user = req.session.userId;
    const allUsers = await getAllUsers();
    // last added user
    let lastAddUser = moment(allUsers[allUsers.length - 1].creation).fromNow();
    let date = new Date();
    // last action on SC
    let scInfo = await getSCInfo();
    let lastSCInfo = (scInfo) ? moment(scInfo.creation).fromNow() : 'none';
    let csInfoActivity = (scInfo) ? scInfo.number : 0;
    // notifications
    let notifs = await getNotifs();
    res.render('index', {
        login: false,
        active: 'home',
        active_sub: '',
        year: date.getFullYear(),
        date_short: script.getDateNow().join("/"),
        date_long: date.toDateString(),
        user: user,
        allUsers: allUsers,
        lastAddUser: lastAddUser,
        lastSCInfo: lastSCInfo,
        csInfoActivity: csInfoActivity,
        notifs: notifs
    });
});

/**
 * USERS - Add new user.
 */
router.route('/add-new-user').get(redirectLogin, async (req, res) => {
    const user = req.session.userId;
    // notifications
    let notifs = await NotifSchema.find();
    notifs.forEach(async e => {e.moment = moment(e.creation).fromNow()});
    res.render('add-new-user', {login: false, active: 'users', active_sub: 'add-new-user', year: new Date().getFullYear(), user: user, notifs: notifs});
});

/**
 * USERS - set user access.
 */
router.route('/set-user-access').post(checkSessionInPost, (req, res) => {
    script.accessDB(async () => {
        // find all users
        let user = {access: req.body.access}
        await UserSchema.findOneAndUpdate({email: req.body.email}, user);
        // set notif
        let notif = {
            category: 'user',
            description: 'An user access has been ' + (req.body.access == 'true' ? 'given' : 'closed'),
            creation: new Date()
        }
        await new NotifSchema(notif).save();
    });
    
    return res.send({
        status: true,
        message: 'Access successfully set.'
    });
});

/**
 * USERS - Delete new user.
 */
router.route('/delete-user').post(checkSessionInPost, (req, res) => {
    mongoose.connect(
        process.env.MONGO_URI,
        MongooOptions
    ).then(async () => {
        // find all users
        await UserSchema.findOneAndDelete({email: req.body.email});
        // set notif
        let notif = {
            category: 'user',
            description: 'An user has been deleted.',
            creation: new Date()
        }
        await new NotifSchema(notif).save();
        // send response
        res.send({
            status: true,
            message: 'User successfully removed.'
        });
    }).catch(err => {
        res.send({
            target: 'database',
            status: false,
            message: 'Unable to connect the database.'
        });
    })
});

/**
 * USERS - Users list.
 */
router.route('/users-list').get(redirectLogin, checkType, async (req, res) => {
    const user = req.session.userId;
    mongoose.connect(
        process.env.MONGO_URI,
        MongooOptions
    ).then(async () => {
        // find all users
        let users = await UserSchema.find();
        // notifications
        let notifs = await getNotifs();
        return res.render('users-list', {login: false, active: 'users', active_sub: 'users-list', year: new Date().getFullYear(), users: users, user: user, notifs: notifs});
    }).catch(err => {
        res.send({
            target: 'database',
            status: false,
            message: 'Unable to connect the database.'
        });
    })
});


/**
 * USERS - Manage access.
 */
 router.route('/manage-access').get(redirectLogin, checkType, async (req, res) => {
    const user = req.session.userId;
    mongoose.connect(
        process.env.MONGO_URI,
        MongooOptions
    ).then(async () => {
        // find all users
        let users = await UserSchema.find();
        // notifications
        let notifs = await getNotifs();
        res.render('manage-access', {login: false, active: 'users', active_sub: 'manage-access', year: new Date().getFullYear(), users: users, user: user, notifs: notifs});
    }).catch(err => {
        res.send({
            target: 'database',
            status: false,
            message: 'Unable to connect the database.'
        });
    })
});

/**
 * USERS - Edit user.
 */
 router.route('/edit-user/:email').all(redirectLogin, checkType, async (req, res) => {
    const userS = req.session.userId;
    mongoose.connect(
        process.env.MONGO_URI,
        MongooOptions
    ).then(async () => {
        if (req.method === 'POST') {
            let user = await {
                username: req.body.username,
                email: req.body.email,
                usertype: req.body.userType,
            }
            // check username
            let userSelected = await UserSchema.findOne({email: user.email});
            let find_username = await UserSchema.findOne({username: user.username});
            let find_email = await UserSchema.findOne({email: user.email});
            // if username found
            let data = [];
            if (find_username) {
                if (userSelected.username !== user.username)
                    data.push({
                        target: 'username',
                        message: 'The username is already taken. Please, try another.'
                    });  
            } 
            // if username found
            if (find_email) {
                if (userSelected.email !== req.params.email)
                    data.push({
                        target: 'email',
                        message: 'The email address is already used. Please, try another.'
                    });
            } 
    
            // if data is not empty
            if (data.length > 0) {
                res.send({
                    status: false,
                    data: data
                });
            } else {
                // save user
                await UserSchema.findOneAndUpdate({email: req.params.email}, user);

                // check if active user
                if (req.params.email === userS.email) {
                    let token = await UserSchema.findOne({email: user.email});
                    req.session.userId = token;
                }
                
                // set notif
                let notif = {
                    category: 'user',
                    description: 'An user has been updated.',
                    creation: new Date()
                }
                await new NotifSchema(notif).save();
                
                await res.send({
                    status: true,
                    message: 'User successfully updated!'
                });
            }
        } else { // GET
            // find all users
            let userEdit = await UserSchema.findOne({email: req.params.email});
            if (userEdit) {
                // notifications
                let notifs = await NotifSchema.find();
                notifs.map(async e => e.creation = moment(e.creation).fromNow());
                return res.render('edit-user', {login: false, active: 'users', active_sub: 'users-list', year: new Date().getFullYear(), userEdit: userEdit, user: userS, notifs: notifs});
            } else {
                res.redirect('/users-list');
            }
        }
    }).catch(err => {
        console.log(err);
        res.send({
            target: 'database',
            status: false,
            message: 'Unable to connect the database.'
        });
    })
});

/**
 * Add user
 */
router.route('/add-user').post(checkSessionInPost, checkType, (req, res) => {
    mongoose.connect(
        process.env.MONGO_URI,
        MongooOptions
    ).then(async () => {
        let user = await req.body;

        let random_code = req.body.random_code;
        // check username
        let find_username = await UserSchema.findOne({username: user.username});
        let find_email = await UserSchema.findOne({email: user.email});
        // if username found
        let data = [];
        if (find_username) {
            data.push({
                target: 'username',
                message: 'The username is already taken. Please, try another.'
            });  
        } 
        // if username found
        if (find_email) {
            data.push({
                target: 'email',
                message: 'The email address is already used. Please, try another.'
            });
        } 

        // if data is not empty
        if (data.length > 0) {
            res.send({
                status: false,
                data: data
            });
        } else {
            if (random_code) {
                // generate random code
                let random = script.randomCode();
                user.password = random;
                var mailOptions = {
                    from: process.env.MAIN_USER,
                    to: user.email,
                    subject: "Authentification code for Salary Calculation",
                    html:
                      `<div style="padding: 8px; background-color: aliceblue;">
                      <center>
                      <h1>Salary Calculation Authentification</h1>
                      <table border="1" style="background:white; width: 400px; border-color: #eee; padding: 8px;border-collapse: collapse;">
                          <tbody>
                              <tr>
                                  <th style="text-align: left;  padding: 8px !important;">Your username:</th>
                                  <td style="padding: 8px !important;">${user.username}</td>
                              </tr>
                              <tr>
                                  <th style="text-align: left;  padding: 8px !important;">Your password:</th>
                                  <td style="padding: 8px !important;">${user.password}</td>
                              </tr>
                          </tbody>
                      </table>
                      <br>
                      </center>
                    </div>`,
                };
                await transporter.sendMail(mailOptions, function (error, info) {
                    error ? console.log(error) : console.log(info);
                    transporter.close();
                });
                
            }
                
            // set notif
            let notif = {
                category: 'user',
                description: 'An user has been added.',
                creation: new Date()
            }
            await new NotifSchema(notif).save();
        
            // save user
            await UserSchema(user).save();
            await res.send({
                status: true,
                message: 'Users successfully registrered!'
            });
        }
    }).catch(err => {
        console.log(err);
        res.send({
            target: 'database',
            status: false,
            message: 'Unable to connect the database.'
        });
    });
})


/**
 * PROGRAMME - Salary Calculation.
 */
 router.route('/salary-calculation').get(redirectLogin, async (req, res) => {
    // notifications
    let notifs = await getNotifs();
    res.render('salary-calculation', {login: false, active: 'salary-calculation', active_sub: 'salary-calculation', year: new Date().getFullYear(), user: req.session.userId, notifs: notifs});
});

/**
 * UPLOAD - RH file and Salary Sheet file.
 */
 router.route('/upload-xlsx').post(checkSessionInPost, async (req, res) => { 
    try {
        if(!req.files) {
            return res.send({
                status: false,
                icon: 'warning',
                message: 'No files uploaded!'
            });
        } else {
            /* socket */
            await req.app.get('socket').emit('action-' + req.session.userId.email, 'Starting data extraction...');
            // file directory
            const DIR = await 'uploads';
            // verifier le repertoire
            if (!fs.existsSync(DIR)) {
                await fs.mkdirSync(DIR);
            }
            // files
            const FILES = await req.files;
            // file keys
            const FileKeys = await Object.keys(FILES);
            // get the global salary sheet
            const GSSFile = await req.files['sheet_file'];
            // check files
            // NO Sheet file selected
            if (!GSSFile || FileKeys.length === 1) {
                return await res.send({
                    status: false,
                    icon: 'warning',
                    message: !GSSFile ? 'No GLOBAL SALARY Sheet file uploaded!' : 'No file that contains data uploaded!'
                });
            } 
            // time to file
            const time = await new Date().getTime();
            // gs path
            const GSSPATH = await `${DIR}/${GSSFile.name.split('.xlsx')[0]}_${time}.xlsx`;
            // COPY GSS FILE
            await GSSFile.mv(GSSPATH);
            /* socket */
            await req.app.get('socket').emit('action-' + req.session.userId.email, 'Cloning: ' + GSSFile.name);
            // read sheet output file
            var wbo_sheet = await script.readWBxlsx(GSSPATH);
            var wbo_sheet_style = await script.readWBxlsxstyle(GSSPATH);
            // create the output file name
            let date = await new Date();
            
            const OPFileName = await `${script.getDateNow().join(".")} GSS ${date.getTime()}.xlsx`;
            const OPFilePath = await `${DIR}/${OPFileName}`;
            /* socket */
            await req.app.get('socket').emit('action-' + req.session.userId.email, 'Creating output filename as: ' + OPFileName);
            // warnigngs
            const Warnings = await [];
            // step
            var output = null;
            // loop keys 
            for (let i = 0; i < FileKeys.length; i++) {
                let key = await FileKeys[i];
                // get file
                let file = await FILES[key];
                let filePath = await `${DIR}/${file.name.split('.xlsx')[0]}_${time}.xlsx`;
                /* socket */
                await req.app.get('socket').emit('action-' + req.session.userId.email, 'Copying and Reading: ' + file.name);
                // move file
                await file.mv(filePath);
                // set file timeout to delete  for 15 minutes
                // await script.deleteFile(filePath, 90 * 1000);
                // read excel file
                var wbi = await script.readWBxlsx(filePath);
                /* socket */
                await req.app.get('socket').emit('action-' + req.session.userId.email, 'Fetching all data from: ' + file.name);
                // switch key file
                switch (key) {
                    case 'rh_file':
                        var sheetName = await 'Repas & Transport';
                        var sheetIndex = await script.getSheetIndex(wbi, sheetName) || 7;
                        //.get work sheet rh
                        var ws = await script.getWS(wbi, sheetIndex);
                        // check sheets
                        if (!ws) {
                            await Warnings.push({
                                status: false,
                                icon: 'warning',
                                message: `The RH file has a problem. No "${sheetName}" sheetname found. Please check the file.`
                            });
                        } else {
                            try {
                                // fetch all data required
                                var data = await script.fetchData(ws);
                                // if data is empty
                                if (data.length <= 0) {
                                    await Warnings.push({
                                        status: false,
                                        icon: 'warning',
                                        message: 'No data found in the RH file.'
                                    });
                                } else {
                                    /* socket */
                                    await req.app.get('socket').emit('action-' + req.session.userId.email, 'Writing all data fetched into: ' + OPFileName);
                                    // output file
                                    // if step one is done change the to the output file.
                                    output = await script.createOutput(data, output || wbo_sheet);
                                }
                            } catch (error) {
                                await Warnings.push({
                                    status: false,
                                    icon: 'danger',
                                    message: 'The RH file has a big problem.'
                                });
                            }
                        }
                        break;
                    // UNIFIED POST
                    case 'salaryup_file':
                        var sheetName = await 'UnifiedPost Salaris per agent';
                        var sheetIndex = await 1;//script.getSheetIndex(wbi, sheetName);
                        ws = await script.getWS(wbi, sheetIndex);
                        if (!ws) {
                            await Warnings.push({
                                status: false,
                                icon: 'warning',
                                message: `The UP Salary file has a problem. No "${sheetName}" sheetname found. Please verify the file.`
                            });
                        } else {
                            try {
                                data = await script.getSalaryUPData(ws);
                                // if data is empty
                                if (data.length <= 0) {
                                    await Warnings.push({
                                        status: false,
                                        icon: 'warning',
                                        message: 'No data found in the UP Salary file! Please verify it.'
                                    });
                                } else {
                                    /* socket */
                                    await req.app.get('socket').emit('action-' + req.session.userId.email, 'Writing all data fetched into: ' + OPFileName);
                                    // if step one is done change the to the output file.
                                    output = await script.createOutputSalaryUp(data, output || wbo_sheet);
                                }
                            } catch (error) {
                                console.log(error)
                                await Warnings.push({
                                    status: false,
                                    icon: 'danger',
                                    message: 'The UP Salary file has a big problem.'
                                });
                            }
                        }
                        break;
                    // AGROBOX
                    case 'salaryagrobox_file':
                        var sheetName = await 'agrobox salaries per agent';
                        var sheetIndex = await script.getSheetIndex(wbi, sheetName);
                        ws = await script.getWS(wbi, 1);
                        if (!ws) {
                            await Warnings.push({
                                status: false,
                                icon: 'warning',
                                message: `The Agrobox Salary file has a problem. No "${sheetName}" sheetname found. Please verify the file.`
                            });
                        } else {
                            try {
                                data = await script.getSalaryAgroboxData(ws);
                                // if data is empty
                                if (data.length <= 0) {
                                    await Warnings.push({
                                        status: false,
                                        icon: 'warning',
                                        message: 'No data found in the Agrobox Salary file! Please verify it.'
                                    });
                                } else {
                                    /* socket */
                                    await req.app.get('socket').emit('action-' + req.session.userId.email, 'Writing all data fetched into: ' + OPFileName);
                                    // if step one is done change the to the output file.
                                    output = await script.createOutputSalaryAGROBOX(data, output || wbo_sheet);
                                }
                            } catch (error) {
                                await Warnings.push({
                                    status: false,
                                    icon: 'danger',
                                    message: 'The Agrobox Salary file has a big problem.'
                                });
                            }
                        }
                        break;
                    case 'salaryarco_file':
                        var sheetName = await 'Summary';
                        var sheetIndex = await script.getSheetIndex(wbi, sheetName);
                        ws = await script.getWS(wbi, 1);
                        if (!ws) {
                            await Warnings.push({
                                status: false,
                                icon: 'warning',
                                message: `The Arco Salary file has a problem. No "${sheetName}" sheetname found. Please verify the file.`
                            });
                        } else {
                            try {
                                data = await script.getSalaryArcoData(ws);
                                // if data is empty
                                if (data.length <= 0) {
                                    await Warnings.push({
                                        status: false,
                                        icon: 'warning',
                                        message: 'No data found in the Arco Salary file! Please verify it.'
                                    });
                                } else {
                                    /* socket */
                                    await req.app.get('socket').emit('action-' + req.session.userId.email, 'Writing all data fetched into: ' + OPFileName);
                                    // if step one is done change the to the output file.
                                    output = await script.createOutputSalaryARCO(data, output || wbo_sheet);
                                }
                            } catch (error) {
                                await console.log(error);
                                await Warnings.push({
                                    status: false,
                                    icon: 'danger',
                                    message: 'The Agrobox Salary file has a big problem.'
                                });
                            }
                        }
                        break;
                    // UPC
                    case 'salaryupc_file':
                        var sheetName = await 'UnifiedPost Salaris per agent';
                        var sheetIndex = await script.getSheetIndex(wbi, sheetName);
                        ws = await script.getWS(wbi, 1);
                        if (!ws) {
                            await Warnings.push({
                                status: false,
                                icon: 'warning',
                                message: `The UPC Salary file has a problem. No "${sheetName}" sheetname found. Please verify the file.`
                            });
                        } else {
                            try {
                                data = await script.getSalaryUPCData(ws);
                                // if data is empty
                                if (data.length <= 0) {
                                    await Warnings.push({
                                        status: false,
                                        icon: 'warning',
                                        message: 'No data found in the UPC Salary file! Please verify it.'
                                    });
                                } else {
                                    /* socket */
                                    await req.app.get('socket').emit('action-' + req.session.userId.email, 'Writing all data fetched into: ' + OPFileName);
                                    // if step one is done change the to the output file.
                                    output = await script.createOutputSalaryUPC(data, output || wbo_sheet);
                                }
                            } catch (error) {
                                await Warnings.push({
                                    status: false,
                                    icon: 'danger',
                                    message: 'The UPC Salary file has a big problem.'
                                });
                            }
                        }
                        break;
                        // UPC
                        case 'salaryjefacture_file':
                            var sheetName = await 'Jefacture Salaris per agent';
                            var sheetIndex = await script.getSheetIndex(wbi, sheetName);
                            ws = await script.getWS(wbi, 1);
                            if (!ws) {
                                await Warnings.push({
                                    status: false,
                                    icon: 'warning',
                                    message: `The UPC Salary file has a problem. No "${sheetName}" sheetname found. Please verify the file.`
                                });
                            } else {
                                try {
                                    data = await script.getSalaryJEFACTUREData(ws);
                                    // if data is empty
                                    if (data.length <= 0) {
                                        await Warnings.push({
                                            status: false,
                                            icon: 'warning',
                                            message: 'No data found in the UPC Salary file! Please verify it.'
                                        });
                                    } else {
                                        /* socket */
                                        await req.app.get('socket').emit('action-' + req.session.userId.email, 'Writing all data fetched into: ' + OPFileName);
                                        // if step one is done change the to the output file.
                                        output = await script.createOutputSalaryJEFACTURE(data, output || wbo_sheet);
                                    }
                                } catch (error) {
                                    await Warnings.push({
                                        status: false,
                                        icon: 'danger',
                                        message: 'The UPC Salary file has a big problem.'
                                    });
                                }
                            }
                        break;
                    default:
                        break;
                }
            }

            /* socket */
            await req.app.get('socket').emit('action-' + req.session.userId.email, 'Finishing Data Extraction...');
            // save file 
            if (output)
                await script.saveFile(output, wbo_sheet_style, OPFilePath);
        
            // FINISHED check file
            if (fs.existsSync(OPFilePath)) {
                
                // save info to database
                script.accessDB(async () => {
                    let info = await SCSchema.find();
                    if (info[0]) {
                        info[0].number += 1;
                        info[0].creation = new Date();
                        await SCSchema.findOneAndUpdate({name: 'info'}, info[0])
                    } else {
                        let newinfo = {
                            name: 'info',
                            number: 1
                        }
                        await new SCSchema(newinfo).save();
                    }
                    
                    // set notif
                    let notif = await {
                        category: 'salary calculation',
                        description: 'Salary calculation: recent activity',
                        creation: new Date(),
                        link: OPFileName,
                        user: req.session.userId.username
                    }
                    await new NotifSchema(notif).save();
                });
                
                //send response
                return res.send({
                    status: true,
                    icon: 'success',
                    message: 'The file is processed successfully.',
                    file: OPFileName,
                    warnings: Warnings
                });
            } else {
                //send response
                return res.send({
                    status: false,
                    icon: 'warning',
                    message: 'Can not perform the program.',
                    file: OPFileName,
                    warnings: Warnings
                });
            }
        }
    } catch (err) {
        console.log(err)
        res.status(500).send({status: false, icon: 'error', message: 'Server error!'});
    }
});

router.route('/arco-start').post(async (req, res) => {
    var session = Session[req.session.userId.username];
    try {
        if(!req.files) {
            return await res.send({
                status: false,
                icon: 'warning',
                message: 'No files uploaded!'
            });
        } else {
            // file directory
            const DIR = await 'uploads';
            // files
            const FILES = await req.files;
            // verifier le repertoire
            if (!fs.existsSync(DIR)) {
                await fs.mkdirSync(DIR);
            }
            // file keys
            var FileKeys = await Object.keys(FILES);
            // get the global salary sheet
            const ARCOFile = await FILES['arco_salary'];
            // check files
            // NO Sheet file selected
            if (!ARCOFile || FileKeys.length === 1) {
                return res.send({
                    status: false,
                    icon: 'warning',
                    message: !ARCOFile ? 'No ARCO Salary file uploaded!' : 'No ARCO Report file uploaded!'
                });
            } 
            
            // time to file
            const time = await new Date().getTime().toString(32);
            // gs path
            var ARCOPath = await `${DIR}/${ARCOFile.name.split('.xlsx')[0]}_${time} by ${req.session.userId.username||'scapp'}.xlsx`;
            
            await ARCOFile.mv(ARCOPath);

            // read sheet output file
            await req.app.get('socket').emit('action-' + req.session.userId.email, 'Cloning: ' + ARCOFile.name);

            await arco.readFileAsync(ARCOPath).then(async (wbo) => {
                // create the output file name
                let date = await new Date();
                // salary working filename
                let firstDate = script.getFirstDateInOutputFilename(ARCOFile.name);
                session.OPFileName = await `${firstDate || script.getDateInFileName(FILES[FileKeys[0]].name)}-${script.getDateInFileName(FILES[FileKeys[FileKeys.length - 2]].name)} ARCO SALARIES WORKING CORRECTED ${date.getTime()} by ${req.session.userId.username||'scapp'}.xlsx`;
                var OPFilePath = await `${DIR}/${session.OPFileName}`;
                
                // loop keys 
                await FileKeys.splice(FileKeys.indexOf('arco_salary'), 1);
                for (let i = 0; i < FileKeys.length; i++) {
                    try {
    
                        let key = await FileKeys[i];
                        let file = await req.files[key];
                        
                        let filePath = await `${DIR}/${file.name.split('.xlsx')[0]}_${time.toString(32)} by ${req.session.userId.username||'scapp'}.xlsx`;
            
                        // move file
                        await file.mv(filePath);
        
                        /* socket */
                        await req.app.get('socket').emit('action-' + req.session.userId.email, 'Copying all data from: ' + (file.name));
    
                        // copy all data
                        wbo = await arco.doCopy(wbo, filePath);
    
                    } catch (error) {
                        console.log(error);
                    }
                }

                await req.app.get('socket').emit('action-' + req.session.userId.email, 'Finishing copy...');
                // save file
                await wbo.toFileAsync(OPFilePath).then(() => {
                    // save info to database
                    script.accessDB(async () => {
                        // set notif
                        await new NotifSchema({
                            category: 'arco',
                            description: 'ARCO salary working: recent activity by ' + req.session.userId.username,
                            creation: new Date(),
                            link: session.OPFileName,
                            user: req.session.userId.username
                        }).save();
                    });
                }).catch(err => console.log(err)).finally(() => {
                    return res.send({
                        status: true,
                        icon: 'success',
                        message: 'Successfully',
                        file: session.OPFileName,
                    });
                });
                
            }).catch(e => {
                console.log(e);
                return res.send({
                    status: false,
                    icon: 'success',
                    message: 'Error',
                });
            });
        } 
    } catch (error) {
        console.log(error);
        return res.send({
            status: false,
            icon: 'error',
            message: 'Error'
        });
    }
});


/**
 * ARCO - PREPARING OUTPUT FILE
 */
router.route('/arco-salaries-working').get(redirectLogin, async (req, res) => {
    Session[req.session.userId.username] = {};
    let io = req.app.get('io');
    io.on('connection', (socket) => {
        socket.on('prepareoutput-' + req.session.userId.email, async() => {
            if (!Session[req.session.userId.username]) return;
            await socket.emit('result', {
                status: true,
                file: Session[req.session.userId.username].OPFileName,
            });
            await delete(Session[req.session.userId.username]);
        });
    });
    mongoose.connect(
        process.env.MONGO_URI,
        MongooOptions
    ).then(async () => {
        // notifications
        let notifs = await getNotifs();
        res.render('arco-salaries-working', {login: false, active: 'arco', active_sub: 'arco-salaries-working', year: new Date().getFullYear(), user: req.session.userId, notifs: notifs});
    }).catch(err => {
        res.send({
            target: 'database',
            status: false,
            message: 'Unable to connect the database.'
        });
    });
});

/**
 *  ARCO CROSS-CHECK
 */
router.route('/arco-analysis-working').get(redirectLogin, async (req, res) => {
    Session[req.session.userId.username] = {};
    let io = req.app.get('io');
    io.on('connection', (socket) => {
        socket.on('prepareoutput1-' + req.session.userId.email, async() => {
            if (!Session[req.session.userId.username]) return;
            await socket.emit('result', {
                status: true,
                file: Session[req.session.userId.username].OPFileName,
            });
            await delete(Session[req.session.userId.username]);
        });
    });
    mongoose.connect(
        process.env.MONGO_URI,
        MongooOptions
    ).then(async () => {
        // notifications
        let notifs = await getNotifs();
        res.render('arco-analysis-working', {login: false, active: 'arco', active_sub: 'arco-analysis-working', year: new Date().getFullYear(), user: req.session.userId, notifs: notifs});
    }).catch(err => {
        res.send({
            target: 'database',
            status: false,
            message: 'Unable to connect the database.'
        });
    });
});


router.route('/arco-start-check').post(async (req, res) => {
    var session = Session[req.session.userId.username];
    try {
        if(!req.files) {
            return await res.send({
                status: false,
                icon: 'warning',
                message: 'No files uploaded!'
            });
        } else {
            // file directory
            const DIR = await 'uploads';
            // files
            const FILES = await req.files;
            // verifier le repertoire
            if (!fs.existsSync(DIR)) {
                await fs.mkdirSync(DIR);
            }
            // file keys
            var FileKeys = await Object.keys(FILES);
            // get the global salary sheet
            const Template = await FILES['template'];
            // check files
            // NO Sheet file selected
            if (!Template || FileKeys.length === 1) {
                return res.send({
                    status: false,
                    icon: 'warning',
                    message: !Template ? 'No Template file uploaded!' : 'No ARCO Report file uploaded!'
                });
            } 
            
            // time to file
            const time = await new Date().getTime().toString(32);
            // gs path
            var TemplatePath = await `${DIR}/${Template.name.split('.xlsx')[0]}_${time} by ${req.session.userId.username||'scapp'}.xlsx`;
            
            await Template.mv(TemplatePath);

            // read sheet output file
            await req.app.get('socket').emit('action-' + req.session.userId.email, 'Cloning: ' + Template.name);

            await arco.readFileAsync(TemplatePath).then(async (wbo) => {
                // create the output file name
                let date = await new Date();
                // Array to stock all data in the report files
                let Data = [];
                // loop keys 
                await FileKeys.splice(FileKeys.indexOf('template'), 1);
                for (let i = 0; i < FileKeys.length; i++) {
                    try {
                        let key = await FileKeys[i];
                        let file = await req.files[key];
                        
                        let filePath = await `${DIR}/${file.name.split('.xlsx')[0]}_${time.toString(32)} by ${req.session.userId.username||'scapp'}.xlsx`;
            
                        // move file
                        await file.mv(filePath);
        
                        /* socket */
                        await req.app.get('socket').emit('action-' + req.session.userId.email, 'Fetching all data from: ' + (file.name));
    
                        // copy all data
                        Data = await arco.getAndMergeData(filePath, Data);
    
                    } catch (error) {
                        console.log(error);
                    }
                }

                // set date interval
                let dateInterval = `${script.getFirstDateInOutputFilename(Template.name) || script.getDateInFileName(FILES[FileKeys[0]].name)}-${script.getDateInFileName(FILES[FileKeys[FileKeys.length - 1]].name)}`;

                // fill in the template
                wbo = await arco.fillTemplateWithData(wbo, Data, dateInterval);
                // output filename
                session.OPFileName = await `${dateInterval} ARCO ANALYSIS WORKING ${date.getTime()} by ${req.session.userId.username||'scapp'}.xlsx`;

                await req.app.get('socket').emit('action-' + req.session.userId.email, 'Finishing copy...');
                // save file
                await wbo.toFileAsync(`${DIR}/${session.OPFileName}`).then(() => {
                    // save info to database
                    Data = [];
                    script.accessDB(async () => {
                        // set notif
                        await new NotifSchema({
                            category: 'arco',
                            description: 'ARCO analysis working: recent activity by ' + req.session.userId.username,
                            creation: new Date(),
                            link: session.OPFileName,
                            user: req.session.userId.username
                        }).save();
                    });
                }).catch(err => {
                    console.log(err);
                    return res.send({
                        status: false,
                        icon: 'error',
                        message: 'An error is occured while saving the output file.',
                    });
                }).finally(() => {
                    return res.send({
                        status: true,
                        icon: 'success',
                        message: 'Successfully',
                        file: session.OPFileName,
                    });
                });
                
            }).catch(e => {
                console.log(e);
                return res.send({
                    status: false,
                    icon: 'error',
                    message: 'An error is occured. Please, restart the program.',
                });
            });
        } 
    } catch (error) {
        console.log(error);
        return res.send({
            status: false,
            icon: 'error',
            message: 'There are some errors. Please restart the program.'
        });
    }
});


module.exports = router;