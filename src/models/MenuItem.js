// MenuItem model for menu management
const { supabase } = require('../config/supabase-client');

class MenuItem {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.price = parseFloat(data.price);
    this.category = data.category;
    this.imageUrl = data.image_url || data.imageUrl;
    this.spicy = Boolean(data.spicy);
    this.vegetarian = Boolean(data.vegetarian);
    this.available = Boolean(data.available);
    this.featured = Boolean(data.featured);
    this.sortOrder = data.sort_order || data.sortOrder || 0;
    this.createdAt = data.created_at || data.createdAt;
    this.updatedAt = data.updated_at || data.updatedAt;
  }

  // Get all menu items with optional filtering
  static async findAll(filters = {}) {
    let query = supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('category')
      .order('sort_order')
      .order('name');

    // Apply filters
    if (filters.category) {
      query = query.eq('category', filters.category);
    }
    
    if (filters.featured !== undefined) {
      query = query.eq('featured', filters.featured);
    }
    
    if (filters.spicy !== undefined) {
      query = query.eq('spicy', filters.spicy);
    }
    
    if (filters.vegetarian !== undefined) {
      query = query.eq('vegetarian', filters.vegetarian);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching menu items:', error);
      throw new Error('Failed to fetch menu items');
    }

    return (data || []).map(item => new MenuItem(item));
  }

  // Get menu items by category
  static async findByCategory(category) {
    return this.findAll({ category });
  }

  // Get featured menu items
  static async findFeatured() {
    return this.findAll({ featured: true });
  }

  // Find menu item by ID
  static async findById(id) {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      console.error('Error finding menu item:', error);
      throw new Error('Failed to find menu item');
    }
    
    return data ? new MenuItem(data) : null;
  }

  // Get all categories
  static async getCategories() {
    const { data, error } = await supabase
      .from('menu_items')
      .select('category')
      .eq('available', true);
    
    if (error) {
      console.error('Error fetching categories:', error);
      throw new Error('Failed to fetch categories');
    }

    // Return unique categories
    const categories = [...new Set((data || []).map(item => item.category))];
    return categories.sort();
  }

  // Create new menu item (admin only)
  static async create(itemData) {
    this.validateCreateInput(itemData);
    
    const { data, error } = await supabase
      .from('menu_items')
      .insert({
        name: itemData.name.trim(),
        description: itemData.description?.trim(),
        price: parseFloat(itemData.price),
        category: itemData.category.trim(),
        image_url: itemData.imageUrl?.trim(),
        spicy: Boolean(itemData.spicy),
        vegetarian: Boolean(itemData.vegetarian),
        available: itemData.available !== undefined ? Boolean(itemData.available) : true,
        featured: Boolean(itemData.featured),
        sort_order: parseInt(itemData.sortOrder) || 0
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating menu item:', error);
      throw new Error('Failed to create menu item');
    }
    
    return new MenuItem(data);
  }

  // Update menu item (admin only)
  static async update(id, updateData) {
    const existingItem = await this.findById(id);
    if (!existingItem) {
      throw new Error('Menu item not found');
    }

    // Prepare update object
    const updates = {};
    
    if (updateData.name !== undefined) updates.name = updateData.name.trim();
    if (updateData.description !== undefined) updates.description = updateData.description?.trim();
    if (updateData.price !== undefined) updates.price = parseFloat(updateData.price);
    if (updateData.category !== undefined) updates.category = updateData.category.trim();
    if (updateData.imageUrl !== undefined) updates.image_url = updateData.imageUrl?.trim();
    if (updateData.spicy !== undefined) updates.spicy = Boolean(updateData.spicy);
    if (updateData.vegetarian !== undefined) updates.vegetarian = Boolean(updateData.vegetarian);
    if (updateData.available !== undefined) updates.available = Boolean(updateData.available);
    if (updateData.featured !== undefined) updates.featured = Boolean(updateData.featured);
    if (updateData.sortOrder !== undefined) updates.sort_order = parseInt(updateData.sortOrder);

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating menu item:', error);
      throw new Error('Failed to update menu item');
    }
    
    return new MenuItem(data);
  }

  // Delete menu item (admin only) - soft delete by setting available = false
  static async delete(id) {
    const { data, error } = await supabase
      .from('menu_items')
      .update({ 
        available: false, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error deleting menu item:', error);
      throw new Error('Failed to delete menu item');
    }
    
    return data ? new MenuItem(data) : null;
  }

  // Search menu items
  static async search(searchTerm, filters = {}) {
    const allItems = await this.findAll(filters);
    
    if (!searchTerm) {
      return allItems;
    }

    const term = searchTerm.toLowerCase();
    return allItems.filter(item => 
      item.name.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term) ||
      item.category.toLowerCase().includes(term)
    );
  }

  // Convert to API response format
  toJSON() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      price: this.price,
      category: this.category,
      imageUrl: this.imageUrl,
      spicy: this.spicy,
      vegetarian: this.vegetarian,
      available: this.available,
      featured: this.featured,
      sortOrder: this.sortOrder
    };
  }

  // Validation
  static validateCreateInput(data) {
    const errors = [];
    
    if (!data.name || data.name.trim().length === 0) {
      errors.push('Name is required');
    } else if (data.name.trim().length > 200) {
      errors.push('Name must be less than 200 characters');
    }
    
    if (!data.category || data.category.trim().length === 0) {
      errors.push('Category is required');
    }
    
    if (data.price === undefined || data.price === null) {
      errors.push('Price is required');
    } else {
      const price = parseFloat(data.price);
      if (isNaN(price) || price < 0) {
        errors.push('Price must be a valid positive number');
      }
    }

    if (data.description && data.description.length > 500) {
      errors.push('Description must be less than 500 characters');
    }

    if (data.imageUrl && data.imageUrl.length > 500) {
      errors.push('Image URL must be less than 500 characters');
    }
    
    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }
}

module.exports = MenuItem;