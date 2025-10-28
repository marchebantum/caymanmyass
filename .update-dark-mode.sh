#!/bin/bash
# Script to add dark mode classes to all remaining components
# This script will systematically update class names across all files

echo "Updating dark mode classes across all files..."

# Function to add dark mode to common patterns
add_dark_mode_classes() {
  local file="$1"

  # Update common bg-white patterns
  sed -i 's/className="bg-white rounded/className="bg-white dark:bg-gray-800 rounded/g' "$file"
  sed -i 's/className="bg-white border/className="bg-white dark:bg-gray-800 border/g' "$file"

  # Update border colors
  sed -i 's/border-gray-200/border-gray-200 dark:border-gray-700/g' "$file"

  # Update text colors
  sed -i 's/text-gray-900"/text-gray-900 dark:text-white"/g' "$file"
  sed -i 's/text-gray-600"/text-gray-600 dark:text-gray-400"/g' "$file"
  sed -i 's/text-gray-500"/text-gray-500 dark:text-gray-400"/g' "$file"
  sed -i 's/text-gray-700"/text-gray-700 dark:text-gray-300"/g' "$file"

  # Update gray backgrounds
  sed -i 's/bg-gray-50 /bg-gray-50 dark:bg-gray-700 /g' "$file"
  sed-i 's/bg-gray-100 /bg-gray-100 dark:bg-gray-700 /g' "$file"

  echo "Updated $file"
}

# Apply to all page and component files
for file in src/pages/*.tsx src/components/*.tsx; do
  if [ -f "$file" ]; then
    add_dark_mode_classes "$file"
  fi
done

echo "Dark mode update complete!"
