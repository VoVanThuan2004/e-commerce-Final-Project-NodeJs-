const auth = require('../middlewares/auth');
const express = require('express');
const router = express.Router();
const attributeController = require('../controllers/attributeController');

// API thêm thuộc tính
router.post('/api/v1/attributes/', auth, attributeController.createAttribute);

// API cập nhật thuộc tính
router.put('/api/v1/attributes/:attributeId', auth, attributeController.updateAttribute);

// API xóa thuộc tính
router.delete('/api/v1/attributes/:attributeId', auth, attributeController.deleteAttribute);

// API lấy tất cả thuộc tính
router.get('/api/v1/attributes/', auth, attributeController.getAllAttributes);

module.exports = router;