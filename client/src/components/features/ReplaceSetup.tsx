import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface ReplaceSetupProps {
  replaceQuery: string;
  onReplaceQueryChange: (query: string) => void;
  onGeneratePreview: () => void;
  isLoading: boolean;
  canGenerate: boolean;
}

export const ReplaceSetup: React.FC<ReplaceSetupProps> = ({
  replaceQuery,
  onReplaceQueryChange,
  onGeneratePreview,
  isLoading,
  canGenerate
}) => {
  const [replaceMode, setReplaceMode] = useState<string>('all');
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Replace Setup</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="replace" className="text-sm font-medium text-gray-700">
            Replace With
          </Label>
          <Input
            id="replace"
            placeholder="Enter replacement text..."
            value={replaceQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onReplaceQueryChange(e.target.value)}
            className="w-full"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="replaceMode" className="text-sm font-medium text-gray-700">
              Replace Mode
            </Label>
            <Select
              value={replaceMode}
              onValueChange={setReplaceMode}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Replace All</SelectItem>
                <SelectItem value="first">Replace First</SelectItem>
                <SelectItem value="last">Replace Last</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-3">
            <Switch 
              id="caseSensitive" 
              checked={caseSensitive} 
              onCheckedChange={setCaseSensitive}
            />
            <Label htmlFor="caseSensitive" className="text-sm font-medium text-gray-700">
              Case Sensitive
            </Label>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={onGeneratePreview}
            disabled={!canGenerate || isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isLoading ? 'Generating...' : 'Generate Preview'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};