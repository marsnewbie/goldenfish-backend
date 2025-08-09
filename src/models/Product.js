// Product model for menu management (new structure)
const { supabase } = require('../config/supabase-client');

class Product {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.price = parseFloat(data.price || 0);
    this.categoryId = data.category_id || data.categoryId;
    this.imageUrl = data.image_url || data.imageUrl;
    this.spicy = Boolean(data.spicy);
    this.vegetarian = Boolean(data.vegetarian);
    this.available = Boolean(data.available);
    this.featured = Boolean(data.featured);
    this.sortOrder = data.sort_order || data.sortOrder || 0;
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
    this.options = data.options || [];
  }

  // Get all products with categories and options
  static async findAllWithDetails() {
    // Fetch categories
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order');

    if (catError) {
      console.error('Categories fetch error:', catError);
      throw new Error('Failed to fetch categories');
    }

    // Fetch products
    const { data: products, error: prodError } = await supabase
      .from('products')
      .select('*')
      .eq('available', true)
      .order('category_id, sort_order, name');

    if (prodError) {
      console.error('Products fetch error:', prodError);
      throw new Error('Failed to fetch products');
    }

    // Fetch product options with choices
    const { data: options, error: optError } = await supabase
      .from('product_options')
      .select(`
        id, 
        name, 
        required, 
        product_id,
        product_option_choices (
          id,
          name,
          additional_price,
          sort_order
        )
      `);

    if (optError) {
      console.error('Options fetch error:', optError);
      throw new Error('Failed to fetch product options');
    }

    // Attach options to products
    const productsWithOptions = products.map(prod => {
      const productOptions = (options || [])
        .filter(opt => opt.product_id === prod.id)
        .map(opt => ({
          id: opt.id,
          name: opt.name,
          required: opt.required,
          choices: (opt.product_option_choices || []).sort((a, b) => a.sort_order - b.sort_order)
        }));
      
      return new Product({
        ...prod,
        options: productOptions
      });
    });

    return {
      categories: categories || [],
      products: productsWithOptions || []
    };
  }

  // Find product by ID
  static async findById(id) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error finding product:', error);
      throw new Error('Failed to find product');
    }
    
    return data ? new Product(data) : null;
  }

  // Convert to API response format
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      category_id: this.categoryId,
      imageUrl: this.imageUrl,
      spicy: this.spicy,
      vegetarian: this.vegetarian,
      available: this.available,
      featured: this.featured,
      sort_order: this.sortOrder,
      options: this.options
    };
  }
}

module.exports = Product;