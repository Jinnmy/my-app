const userController = require('./src/server/controllers/userController');
console.log('Keys in userController:', Object.keys(userController));
if (userController.login) {
    console.log('Login function exists type:', typeof userController.login);
} else {
    console.log('Login function does NOT exist');
}
