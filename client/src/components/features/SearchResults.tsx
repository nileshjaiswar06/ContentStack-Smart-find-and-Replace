import React from 'react';
import { SearchResult } from '../../types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SearchResultsProps {
  results: SearchResult[];
  selectedEntries: SearchResult[];
  onEntrySelect: (entry: SearchResult) => void;
  onEntryDeselect: (entryId: string) => void;
}

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  selectedEntries,
  onEntrySelect,
  onEntryDeselect
}) => {
  const isEntrySelected = (entryId: string) => {
    return selectedEntries.some(entry => entry.id === entryId);
  };

  const handleEntryToggle = (entry: SearchResult) => {
    if (isEntrySelected(entry.id)) {
      onEntryDeselect(entry.id);
    } else {
      onEntrySelect(entry);
    }
  };

  const getStatusVariant = (status: string | undefined): "default" | "destructive" | "outline" | "secondary" => {
    if (status === 'published' || status === 'Published') {
      return 'default';
    }
    return 'secondary';
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold text-gray-900">Search Results</CardTitle>
          <Badge variant="outline" className="text-sm">
            {results.length} entries found
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-32">Type</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-36">Last Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((entry) => (
                <TableRow key={entry.id} className="hover:bg-gray-50">
                  <TableCell>
                    <Checkbox
                      checked={isEntrySelected(entry.id)}
                      onCheckedChange={() => handleEntryToggle(entry)}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900">{entry.title}</div>
                      <div className="text-sm text-gray-500">
                        {entry.snippet || `Entry: ${entry.id}`}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.type || 'Unknown'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(entry.status)}>
                      {entry.status || 'Active'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {entry.lastModified ? new Date(entry.lastModified).toLocaleDateString() : 'Unknown'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};