const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const auth = require('../middlewares/auth');

router.post('/api/v1/categories', auth, categoryController.addCategory);
router.get('/api/v1/categories', categoryController.getAllCategories);
router.put('/api/v1/categories/:categoryId', auth, categoryController.updateCategory);
router.delete('/api/v1/categories/:categoryId', auth, categoryController.deleteCategory);

module.exports = router;