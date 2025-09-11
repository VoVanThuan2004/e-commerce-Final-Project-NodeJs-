const express = require('express');
const router = express.Router();
const attributeValueController = require('../controllers/attributeValueController');
const auth = require('../middlewares/auth');

// API thêm giá trị thuộc tính
router.post('/api/v1/attributes/:id/value/', auth, attributeValueController.addAttributeValue);

// API cập nhật giá tri thuộc tính
router.put('/api/v1/attributes/value/:valueId', auth, attributeValueController.updateAttributeValue);

// API xóa giá trị thuộc tính
router.delete('/api/v1/attributes/value/:valueId', auth, attributeValueController.deleteAttributeValue);

// API lấy danh sách giá trị thuộc tính
router.get('/api/v1/attributes/:id/value/', auth, attributeValueController.getAllAttributeValues);


module.exports = router;