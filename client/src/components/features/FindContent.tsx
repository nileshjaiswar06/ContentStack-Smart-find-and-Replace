import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SearchFilters {
  contentType: string;
  locale: string;
  status: string;
}

interface FindContentProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
  onSearch: () => void;
  isLoading: boolean;
}

export const FindContent: React.FC<FindContentProps> = ({
  searchQuery,
  onSearchQueryChange,
  filters,
  onFiltersChange,
  onSearch,
  isLoading
}) => {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Find Content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="search" className="text-sm font-medium text-gray-700">
            Search Query <span className="text-red-500">*</span>
          </Label>
          <Input
            id="search"
            placeholder="Enter text to search for..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onSearchQueryChange(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contentType" className="text-sm font-medium text-gray-700">
              Content Type
            </Label>
            <Select
              value={filters.contentType}
              onValueChange={(value) => onFiltersChange({...filters, contentType: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Content Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Content Types</SelectItem>
                <SelectItem value="article">Article</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="blog">Blog</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locale" className="text-sm font-medium text-gray-700">
              Locale
            </Label>
            <Select
              value={filters.locale}
              onValueChange={(value) => onFiltersChange({...filters, locale: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Locales" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locales</SelectItem>
                <SelectItem value="en-us">English (US)</SelectItem>
                <SelectItem value="en-gb">English (UK)</SelectItem>
                <SelectItem value="es-es">Spanish</SelectItem>
                <SelectItem value="fr-fr">French</SelectItem>
                <SelectItem value="de-de">German</SelectItem>
                <SelectItem value="zh-cn">Chinese (Simplified)</SelectItem>
                <SelectItem value="ja-jp">Japanese</SelectItem>
                <SelectItem value="hi-in">Hindi</SelectItem>
                <SelectItem value="ar-sa">Arabic</SelectItem>
                <SelectItem value="ru-ru">Russian</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status" className="text-sm font-medium text-gray-700">
              Status
            </Label>
            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange({...filters, status: value})}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button 
            onClick={onSearch} 
            disabled={!searchQuery || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};