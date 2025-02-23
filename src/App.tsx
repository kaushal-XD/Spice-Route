import React, { useState } from 'react';
import { Search, ChefHat, Loader2, X, Youtube, Book, Facebook, Twitter, Instagram, Send } from 'lucide-react';
import type { RecipeDetails } from './types';

const GEMINI_API_KEY = 'AIzaSyC9SA_5EfB1KiKbTJlyadv89SRArpNkYIQ';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

type SearchType = 'ingredients' | 'recipe';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function generateRecipeWithGemini(searchTerm: string, searchType: SearchType): Promise<RecipeDetails | RecipeDetails[]> {
  let prompt = '';
  
  if (searchType === 'ingredients') {
    prompt = `Create 6 possible recipe suggestions using these ingredients: ${searchTerm}. 
    For each recipe, provide a brief summary and required additional ingredients.
    
    Format the response EXACTLY as this JSON array with 5 recipes:
    [
      {
        "idMeal": "1",
        "strMeal": "[Recipe name]",
        "strCategory": "[Category]",
        "strArea": "[Cuisine style]",
        "strDescription": "[Brief 2-3 sentence description]",
        "strMealThumb": "https://images.stockcake.com/public/3/c/5/3c5ad8bc-f75a-4747-a7b8-232e8cb54f84_large/chef-preparing-ingredients-stockcake.jpg",
        "additionalIngredients": "[List of additional ingredients needed]",
        "strInstructions": "",
        "strTags": "",
        "strYoutube": ""
      }
    ]`;
  } else {
    prompt = `Create 6  detailed recipes for: ${searchTerm}. 
    Include precise measurements and clear instructions.
    
    Format the response EXACTLY as this JSON structure:
    {
      "idMeal": "1",
      "strMeal": "[Recipe name]",
      "strCategory": "[Category]",
      "strArea": "[Cuisine style]",
      "strInstructions": "[Detailed step-by-step numbered instructions]",
      "strMealThumb": "https://images.stockcake.com/public/3/c/5/3c5ad8bc-f75a-4747-a7b8-232e8cb54f84_large/chef-preparing-ingredients-stockcake.jpg",
      "Ingredients": "[List of all ingredients needed with measurement]",
      "strTags": "Healthy,Easy,Quick",
      "strYoutube": "",
      "strDescription": "[Brief description]",
    }`;
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }]
    })
  });

  if (!response.ok) {
    throw new Error('Failed to generate recipe');
  }

  const data = await response.json();
  
  try {
    const recipeText = data.candidates[0].content.parts[0].text;
    const jsonMatch = recipeText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid recipe format');
    }
    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('Error parsing recipe:', error);
    throw new Error('Failed to parse recipe data');
  }
}

async function chatWithAI(message: string, recipeName: string): Promise<string> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ 
            text: `You are a helpful cooking assistant. The user is asking about the recipe: ${recipeName}. 
            Only answer questions related to cooking, ingredients, techniques, or variations of this specific recipe.
            If the question is not related to this recipe or cooking, politely redirect them to ask about the recipe.
            
            User question: ${message}`
          }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error('Chat error:', error);
    throw new Error('Failed to get AI response');
  }
}

function RecipeCard({ recipe, onClick }: { recipe: RecipeDetails; onClick: () => void }) {
  return (
    <div 
      className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <img 
        src={recipe.strMealThumb || 'https://www.maggi.in/sites/default/files/styles/home_stage_944_531/public/srh_recipes/e209fda9ec6fc987724b115c15060551.jpg?h=88ac1a36&itok=jQwgnyxn'} 
        alt={recipe.strMeal} 
        className="w-full h-48 object-cover"
      />
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">{recipe.strMeal}</h3>
        <p className="text-gray-600 text-sm mb-2">{recipe.strCategory} • {recipe.strArea}</p>
        {recipe.strDescription && (
          <p className="text-gray-700 text-sm">{recipe.strDescription}</p>
        )}
        {recipe.additionalIngredients && (
          <div className="mt-2">
            <p className="text-sm text-gray-500">Additional ingredients needed:</p>
            <p className="text-sm text-gray-700">{recipe.additionalIngredients}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AIGeneratedRecipeModal({ recipe, onClose }: { recipe: RecipeDetails; onClose: () => void }) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const chatContainerRef = React.useRef<HTMLDivElement>(null);

  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isSending) return;

    setIsSending(true);
    const userMessage = currentMessage.trim();
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setCurrentMessage('');

    try {
      const response = await chatWithAI(userMessage, recipe.strMeal);
      setChatMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I had trouble processing your question. Please try again.' 
      }]);
    } finally {
      setIsSending(false);
    }
  };

  React.useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (!recipe) return null;

  const tags = recipe.strTags?.split(',').filter(Boolean) || [];
  const youtubeId = recipe.strYoutube?.split('v=')[1] || '';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">{recipe.strMeal}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <img
                src={recipe.strMealThumb || 'https://images.stockcake.com/public/3/c/5/3c5ad8bc-f75a-4747-a7b8-232e8cb54f84_large/chef-preparing-ingredients-stockcake.jpg'}
                alt={recipe.strMeal}
                className="w-full h-64 object-cover rounded-lg shadow-md"
              />
              
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm">
                  {recipe.strCategory}
                </span>
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                  {recipe.strArea}
                </span>
                {tags.map((tag) => (
                  <span key={tag} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                    {tag.trim()}
                  </span>
                ))}
              </div>

              {youtubeId && (
                <a
                  href={recipe.strYoutube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 text-red-600 hover:text-red-700"
                >
                  <Youtube className="w-5 h-5" />
                  Watch Recipe Video
                </a>
              )}
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-3">Description</h3>
              <p className="text-gray-700 mb-6">{recipe.strDescription}</p>

              {recipe.additionalIngredients && (
                <>
                  <h3 className="text-xl font-semibold mb-3">Additional Ingredients Needed</h3>
                  <p className="text-gray-700 mb-6">{recipe.additionalIngredients}</p>
                </>
              )}
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-xl font-semibold mb-3">Instructions</h3>
            <div className="space-y-4">
              {(recipe.strInstructions || '').split('\n').map((instruction, index) => (
                instruction.trim() && (
                  <p key={index} className="text-gray-700">
                    {instruction}
                  </p>
                )
              ))}
            </div>
          </div>

          {/* Chat Section */}
          <div className="mt-8 border-t pt-6">
            <h3 className="text-xl font-semibold mb-4">Ask About This Recipe</h3>
            <div 
              ref={chatContainerRef}
              className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto mb-4"
            >
              {chatMessages.length === 0 ? (
                <p className="text-gray-500 text-center">
                  Ask questions about the recipe, cooking techniques, or possible variations!
                </p>
              ) : (
                <div className="space-y-4">
                  {chatMessages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-3 ${
                          msg.role === 'user'
                            ? 'bg-orange-500 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about this recipe..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isSending}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  !currentMessage.trim() || isSending
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                } text-white transition-colors`}
              >
                {isSending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Navbar() {
  return (
    <nav className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center">
            <ChefHat className="h-8 w-8 text-orange-500" />
            <span className="ml-2 text-xl font-bold text-gray-900">Spice Route</span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#" className="text-gray-700 hover:text-orange-500 transition-colors">Home</a>
            <a href="#" className="text-gray-700 hover:text-orange-500 transition-colors">Popular Recipes</a>
            <a href="#" className="text-gray-700 hover:text-orange-500 transition-colors">Categories</a>
            <a href="#" className="text-gray-700 hover:text-orange-500 transition-colors">About Us</a>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Footer() {
  const [email, setEmail] = useState('');
  const { setSearchType, setSearchTerm, handleSearch } = useRecipeContext();

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Thank you for subscribing!');
    setEmail('');
  };

  const handleCategoryClick = (category: string) => {
    setSearchType('recipe');
    setSearchTerm(category);
    handleSearch(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center">
              <ChefHat className="h-8 w-8 text-orange-500" />
              <span className="ml-2 text-xl font-bold">Spice Route</span>
            </div>
            <p className="mt-4 text-gray-400">
              Discover delicious recipes from around the world with our ingredient-based recipe finder.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">Home</a></li>
              <li><a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">Popular Recipes</a></li>
              <li><a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">Categories</a></li>
              <li><a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">About Us</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Categories</h3>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => handleCategoryClick('breakfast recipes')}
                  className="text-gray-400 hover:text-orange-500 transition-colors text-left w-full"
                >
                  Breakfast
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleCategoryClick('main course recipes')}
                  className="text-gray-400 hover:text-orange-500 transition-colors text-left w-full"
                >
                  Main Course
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleCategoryClick('dessert recipes')}
                  className="text-gray-400 hover:text-orange-500 transition-colors text-left w-full"
                >
                  Desserts
                </button>
              </li>
              <li>
                <button 
                  onClick={() => handleCategoryClick('beverage recipes')}
                  className="text-gray-400 hover:text-orange-500 transition-colors text-left w-full"
                >
                  Beverages
                </button>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold mb-4">Connect With Us</h3>
            <div className="flex space-x-4 mb-4">
              <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">
                <Facebook className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">
                <Twitter className="h-6 w-6" />
              </a>
              <a href="#" className="text-gray-400 hover:text-orange-500 transition-colors">
                <Instagram className="h-6 w-6" />
              </a>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-2">Subscribe to our newsletter</h4>
              <form onSubmit={handleSubscribe} className="flex">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="px-4 py-2 rounded-l-lg w-full text-gray-900"
                  required
                />
                <button 
                  type="submit"
                  className="bg-orange-500 px-4 py-2 rounded-r-lg hover:bg-orange-600 transition-colors"
                >
                  Subscribe
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

const RecipeContext = React.createContext<any>(null);

function useRecipeContext() {
  const context = React.useContext(RecipeContext);
  if (!context) {
    throw new Error('useRecipeContext must be used within a RecipeProvider');
  }
  return context;
}

function App() {
  const [searchType, setSearchType] = useState<SearchType>('ingredients');
  const [searchTerm, setSearchTerm] = useState('');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [recipeOptions, setRecipeOptions] = useState<RecipeDetails[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (searchQuery?: string) => {
    const termToSearch = searchQuery || searchTerm;
    if (!termToSearch && ingredients.length === 0) return;

    setLoading(true);
    setError('');
    try {
      const searchString = searchType === 'ingredients' ? ingredients.join(', ') : termToSearch;
      const result = await generateRecipeWithGemini(searchString, searchType);
      
      if (Array.isArray(result)) {
        setRecipeOptions(result);
        setSelectedRecipe(null);
      } else {
        const recipes = Array.isArray(result) ? result : [result];
        setRecipeOptions(recipes);
        setSelectedRecipe(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recipe');
    } finally {
      setLoading(false);
    }
  };

  const addIngredient = () => {
    if (searchTerm.trim()) {
      setIngredients([...ingredients, searchTerm.trim()]);
      setSearchTerm('');
    }
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const contextValue = {
    searchType,
    setSearchType,
    searchTerm,
    setSearchTerm,
    handleSearch,
  };

  return (
    <RecipeContext.Provider value={contextValue}>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        
        <main className="flex-grow bg-orange-50">
          <div className="max-w-4xl mx-auto px-4 py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Spice Route</h1>
              <p className="text-xl text-gray-600">Discover recipes by ingredients or name</p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6 max-w-2xl mx-auto">
              <div className="flex gap-4 mb-6">
                <button
                  onClick={() => {
                    setSearchType('ingredients');
                    setSelectedRecipe(null);
                    setRecipeOptions([]);
                    setSearchTerm('');
                  }}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 ${
                    searchType === 'ingredients'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } transition-colors`}
                >
                  <Search className="w-4 h-4" />
                  Search by Ingredients
                </button>
                <button
                  onClick={() => {
                    setSearchType('recipe');
                    setSelectedRecipe(null);
                    setRecipeOptions([]);
                    setIngredients([]);
                  }}
                  className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 ${
                    searchType === 'recipe'
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } transition-colors`}
                >
                  <Book className="w-4 h-4" />
                  Search by Recipe Name
                </button>
              </div>

              {searchType === 'ingredients' ? (
                <>
                  <div className="flex gap-2 mb-4">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addIngredient()}
                      placeholder="Enter an ingredient"
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                    />
                    <button
                      onClick={addIngredient}
                      disabled={!searchTerm.trim()}
                      className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>

                  <div className="mb-6">
                    <div className="flex flex-wrap gap-2">
                      {ingredients.map((ingredient, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-gray-100 rounded-full flex items-center gap-1 text-sm"
                        >
                          {ingredient}
                          <button
                            onClick={() => removeIngredient(index)}
                            className="hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="mb-6">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Enter recipe name"
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  />
                </div>
              )}

              <button
                onClick={() => handleSearch()}
                disabled={loading || (searchType === 'ingredients' ? ingredients.length === 0 : !searchTerm)}
                className={`w-full py-2 rounded-lg flex items-center justify-center gap-2 ${
                  loading || (searchType === 'ingredients' ? ingredients.length === 0 : !searchTerm)
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600'
                } text-white transition-colors text-sm`}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Generate Recipe
                  </>
                )}
              </button>
            </div>

            {error && (
              <p className="mt-4 text-red-500 text-center">{error}</p>
            )}

            {recipeOptions.length > 0 && (
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recipeOptions.map((recipe, index) => (
                  <RecipeCard
                    key={index}
                    recipe={recipe}
                    onClick={() => setSelectedRecipe(recipe)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        <Footer />

        {selectedRecipe && (
          <AIGeneratedRecipeModal
            recipe={selectedRecipe}
            onClose={() => setSelectedRecipe(null)}
          />
        )}
      </div>
    </RecipeContext.Provider>
  );
}

export default App;