
# ===============================================
# 🚀 Vercel Production Environment Setup
# ===============================================
# Run these commands in your terminal to set up the new keys

# 1. HuggingFace PRO Key (For LLM & Embeddings)
# Get key from: https://huggingface.co/settings/tokens
echo "Adding HUGGINGFACE_API_KEY..."
vercel env add HUGGINGFACE_API_KEY production

# 2. Replicate Key (For Image Generation - optional but recommended)
# Get key from: https://replicate.com/account/api-tokens
echo "Adding REPLICATE_API_KEY..."
vercel env add REPLICATE_API_KEY production

# 3. Enable HuggingFace Infrastructure
echo "Setting RAG_PROVIDER to huggingface..."
echo "huggingface" | vercel env add RAG_PROVIDER production

echo "Setting VISION_PROVIDER to huggingface..."
echo "huggingface" | vercel env add VISION_PROVIDER production

# 4. Verify everything is set
vercel env ls production

# ===============================================
# ℹ️ NOTE: After adding these keys, you MUST redeploy:
# vercel --prod
# ===============================================
