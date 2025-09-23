import React from 'react';
import { ReplacementPlan } from '../../types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PreviewVerifyProps {
  replacementPlan: ReplacementPlan[];
  onToggleApproval: (index: number) => void;
  onApplyChanges: () => void;
  isLoading: boolean;
}

export const PreviewVerify: React.FC<PreviewVerifyProps> = ({
  replacementPlan,
  onToggleApproval,
  onApplyChanges,
  isLoading
}) => {
  const approvedCount = replacementPlan.filter(p => p.approved).length;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold text-gray-900">Preview & Verify Changes</CardTitle>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-sm">
              {approvedCount} of {replacementPlan.length} changes selected
            </Badge>
            <Button 
              onClick={onApplyChanges}
              disabled={approvedCount === 0 || isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {isLoading ? 'Applying...' : 'Apply Selected Changes'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {replacementPlan.length > 0 ? (
          <div className="space-y-4">
            {replacementPlan.map((change, index) => (
              <Card key={index} className="border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-4">
                        <Checkbox
                          checked={change.approved}
                          onCheckedChange={() => onToggleApproval(index)}
                        />
                        <span className="font-medium text-sm text-gray-900">
                          {change.title} - {change.changes.length} changes
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {change.changes.map((singleChange, changeIndex) => (
                          <div key={changeIndex} className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-2">
                                Original ({singleChange.path})
                              </label>
                              <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                                {String(singleChange.before)}
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-2">Replacement</label>
                              <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-800">
                                {String(singleChange.after)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No changes to preview</h3>
            <p className="text-gray-500">Generate a preview from the Replace Setup tab</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};