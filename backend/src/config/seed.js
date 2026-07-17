import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Store from '../models/Store.js';
import ProductPrice from '../models/ProductPrice.js';
import PriceHistory from '../models/PriceHistory.js';
import PriceUpdateRequest from '../models/PriceUpdateRequest.js';

export const seedDatabase = async () => {
  try {
    // 1. Clear existing database
    const usersCount = await User.countDocuments();
    if (usersCount > 0) {
      console.log('Database already has data. Skipping seeding.');
      return;
    }

    console.log('Seeding initial database...');

    // 2. Create Users
    const adminPassword = await bcrypt.hash('admin123', 10);
    const userPassword = await bcrypt.hash('user123', 10);

    const admin = new User({
      email: 'admin@super.com',
      password: adminPassword,
      role: 'admin',
    });

    const user = new User({
      email: 'user@super.com',
      password: userPassword,
      role: 'user',
    });

    await admin.save();
    await user.save();
    console.log('Default users created:');
    console.log('  Admin: admin@super.com / admin123');
    console.log('  User: user@super.com / user123');

    // 3. Create Stores (Center: Buenos Aires approx -34.6037, -58.3816)
    const stores = [
      {
        name: 'Carrefour Express',
        brand: 'Carrefour',
        address: 'Av. Corrientes 1250, CABA',
        location: { type: 'Point', coordinates: [-58.3850, -34.6040] },
      },
      {
        name: 'Coto Sucursal 60',
        brand: 'Coto',
        address: 'Sarmiento 1431, CABA',
        location: { type: 'Point', coordinates: [-58.3895, -34.6055] },
      },
      {
        name: 'Supermercado Día%',
        brand: 'Dia',
        address: 'Paraná 456, CABA',
        location: { type: 'Point', coordinates: [-58.3880, -34.6020] },
      },
    ];

    const savedStores = [];
    for (const storeData of stores) {
      const store = new Store(storeData);
      await store.save();
      savedStores.push(store);
    }
    console.log(`${savedStores.length} stores created successfully.`);

    // 4. Create Products
    const products = [
      {
        title: 'Leche Entera Larga Vida 1L',
        description: 'Leche entera ultra pasteurizada con Vitamina A y D',
        barcode_qr: '7790040111111',
        image_url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=200',
        status: 'approved',
      },
      {
        title: 'Pan Lactal Rodajas Finas 400g',
        description: 'Pan lactal clásico de mesa blanco esponjoso',
        barcode_qr: '7790040222222',
        image_url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=200',
        status: 'approved',
      },
      {
        title: 'Café Molido Cabrales Tostado 250g',
        description: 'Café molido tostado clásico paquete rojo',
        barcode_qr: '7790040333333',
        image_url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=200',
        status: 'approved',
      },
      {
        title: 'Fideos Tallarines Lucchetti 500g',
        description: 'Fideos secos semolados tipo tallarín',
        barcode_qr: '7790040444444',
        image_url: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&q=80&w=200',
        status: 'approved',
      },
      {
        title: 'Gaseosa Coca-Cola Original 1.5L',
        description: 'Bebida sin alcohol gaseosa refrescante original',
        barcode_qr: '7790040555555',
        image_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=200',
        status: 'approved',
      },
      {
        title: 'Queso Crema Finlandia 290g',
        description: 'Queso crema clásico para untar Finlandia La Serenísima',
        barcode_qr: '7790040666666',
        image_url: 'https://images.unsplash.com/photo-1528750955925-53f06376597c?auto=format&fit=crop&q=80&w=200',
        status: 'approved',
      },
    ];

    const savedProducts = [];
    for (const prodData of products) {
      const product = new Product(prodData);
      await product.save();
      savedProducts.push(product);
    }
    console.log(`${savedProducts.length} approved products created successfully.`);

    // Add 1 pending product for moderation testing
    const pendingProduct = new Product({
      title: 'Galletitas Oreo Original 117g',
      description: 'Galletitas dulces rellenas sabor vainilla',
      barcode_qr: '7622300741217',
      image_url: 'https://images.unsplash.com/photo-1558961312-503a1fe911e3?auto=format&fit=crop&q=80&w=200',
      status: 'pending_approval',
    });
    await pendingProduct.save();
    console.log('Added 1 pending product for moderation testing.');

    // 5. Create Product Prices (ProductPrice) and historical price points (PriceHistory)
    // We will assign slightly different prices to different stores so that optimization yields distinct recommendations!
    // Carrefour (Store 0), Coto (Store 1), Dia (Store 2)
    const store0 = savedStores[0]._id;
    const store1 = savedStores[1]._id;
    const store2 = savedStores[2]._id;

    const prod0 = savedProducts[0]._id; // Leche
    const prod1 = savedProducts[1]._id; // Pan
    const prod2 = savedProducts[2]._id; // Café
    const prod3 = savedProducts[3]._id; // Fideos
    const prod4 = savedProducts[4]._id; // Coca-Cola
    const prod5 = savedProducts[5]._id; // Queso Finlandia

    const pricingMatrix = [
      // Product 0: Leche
      { product: prod0, store: store0, price: 950, history: [880, 910, 930, 950] },
      { product: prod0, store: store1, price: 920, history: [870, 900, 910, 920] },
      { product: prod0, store: store2, price: 980, history: [890, 920, 960, 980] },

      // Product 1: Pan
      { product: prod1, store: store0, price: 1600, history: [1400, 1500, 1550, 1600] },
      { product: prod1, store: store1, price: 1750, history: [1500, 1650, 1700, 1750] },
      { product: prod1, store: store2, price: 1500, history: [1350, 1400, 1450, 1500] },

      // Product 2: Café
      { product: prod2, store: store0, price: 3400, history: [3100, 3200, 3300, 3400] },
      { product: prod2, store: store1, price: 3150, history: [2900, 3000, 3100, 3150] },
      { product: prod2, store: store2, price: 3500, history: [3200, 3350, 3450, 3500] },

      // Product 3: Fideos
      { product: prod3, store: store0, price: 820, history: [750, 780, 800, 820] },
      { product: prod3, store: store1, price: 850, history: [780, 810, 830, 850] },
      { product: prod3, store: store2, price: 790, history: [720, 750, 770, 790] },

      // Product 4: Coca-Cola
      { product: prod4, store: store0, price: 2100, history: [1800, 1950, 2050, 2100] },
      { product: prod4, store: store1, price: 1950, history: [1750, 1850, 1900, 1950] },
      { product: prod4, store: store2, price: 2050, history: [1800, 1900, 2000, 2050] },

      // Product 5: Queso Finlandia (Not sold in Store 2 - Dia, to test partial coverage)
      { product: prod5, store: store0, price: 2800, history: [2500, 2600, 2700, 2800] },
      { product: prod5, store: store1, price: 2950, history: [2600, 2750, 2850, 2950] },
    ];

    for (const item of pricingMatrix) {
      // Create current active price
      const activePrice = new ProductPrice({
        product_id: item.product,
        store_id: item.store,
        price: item.price,
        updated_at: new Date(),
      });
      await activePrice.save();

      // Create historical points (older dates)
      for (let i = 0; i < item.history.length; i++) {
        const histPrice = item.history[i];
        const daysAgo = (item.history.length - 1 - i) * 10; // 30 days ago, 20 days ago, 10 days ago, today
        const historyDate = new Date();
        historyDate.setDate(historyDate.getDate() - daysAgo);

        const historyRecord = new PriceHistory({
          product_id: item.product,
          store_id: item.store,
          price: histPrice,
        });
        // Override mongoose's automatically created updatedAt with custom historical date
        await historyRecord.save();
        historyRecord.updated_at = historyDate;
        await historyRecord.save();
      }
    }

    console.log('Product active pricing and historical records seeded successfully.');

    // 6. Add 1 pending price request for moderation testing
    const pendingPriceRequest = new PriceUpdateRequest({
      product_id: prod0, // Leche
      store_id: store0, // Carrefour
      proposed_price: 1100, // Current active is 950
      submitted_by: user._id,
      status: 'pending',
    });
    await pendingPriceRequest.save();
    console.log('Added 1 pending price update request for moderation testing.');
    console.log('Database Seeding finished successfully!');
  } catch (error) {
    console.error('Error during database seeding:', error);
  }
};
