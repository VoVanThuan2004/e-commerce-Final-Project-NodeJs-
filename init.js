const bcrypt = require('bcrypt');
const Role = require('./models/role');
const User = require('./models/user');

const initAdminAccount = async () => {
    const roleAdmin = 'ADMIN';
    const roleUser = 'USER';

    // Kiểm tra role user có chưa 
    const roleUserExisting = await Role.findOne({ roleName: roleUser });
    if (!roleUserExisting) {
        // Tạo mới Role
        await Role.create({
            roleName: roleUser,
            description: 'Role dành cho khách hàng sử dụng hệ thống, mua sản phẩm, đặt hàng, ...'
        });

        console.log('Role USER đã được tạo!');
    }



    // Kiểm tra role admin có tồn tại chưa
    let roleAdminExisting = await Role.findOne({ roleName: roleAdmin });
    if (!roleAdminExisting) {
        // Tạo role mới 
        roleAdminExisting = await Role.create({
            roleName: roleAdmin,
            description: 'Role dành cho quản lý, thực hiện các thao tác CRUD sản phẩm, tồn kho, số lượng, danh mục, ...'
        });

        console.log('Role ADMIN đã được tạo!');

        // Tạo tài khoản cho admin
        const passwrodHashed = await bcrypt.hash('Admin12345', 10);
        await User.create({
            roleId: roleAdminExisting._id,
            email: 'admin@gmail.com',
            fullName: 'Admin',
            password: passwrodHashed,
            isActive: true
        });

        console.log('Tài khoản Admin đã được tạo thành công');
    }
    else {
        console.log('Tài khoản Admin đã tồn tại');
    }
}

module.exports = initAdminAccount;