import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/utilities';
import { Star, TrendingUp, Award, Clock } from 'lucide-react';

interface PerformanceData {
  averageRating: number;
  reliabilityScore: number;
  onTimeCompletionRate: number;
  qualityScore: number;
  disputeCount: number;
}

interface PerformanceDashboardProps {
  workerId: string;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({ workerId }) => {
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPerformance();
  }, [workerId]);

  const fetchPerformance = async () => {
    try {
      const response = await supabase.functions.invoke('calculate-performance-score-fixed', {
        body: { workerId }
      });

      if (response.data?.data?.performance) {
        setPerformance(response.data.data.performance);
      }
    } catch (error) {
      console.error('Error fetching performance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!performance) {
    return null;
  }

  return (
    <Card className="shadow-xl border-0 bg-white/90 backdrop-blur">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-t-lg">
        <CardTitle className="flex items-center text-white">
          <TrendingUp className="h-5 w-5 mr-2" />
          My Average Performance
        </CardTitle>
        <CardDescription className="text-purple-100">
          Career-average scores from employer feedback
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Average Rating */}
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-yellow-600" />
              <span className="text-2xl font-bold text-yellow-700">
                {performance.averageRating?.toFixed(1) || '0.0'}/5
              </span>
            </div>
            <p className="text-xs text-yellow-600 font-medium">Average Rating</p>
          </div>

          {/* Reliability Score */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between mb-2">
              <Award className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-700">
                {performance.reliabilityScore?.toFixed(1) || '0.0'}/5
              </span>
            </div>
            <p className="text-xs text-green-600 font-medium">Reliability Score</p>
          </div>

          {/* On-Time Rate */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <span className="text-2xl font-bold text-purple-700">
                {performance.onTimeCompletionRate?.toFixed(1) || '0.0'}/5
              </span>
            </div>
            <p className="text-xs text-purple-600 font-medium">On-Time Rate</p>
          </div>

          {/* Quality Score */}
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center justify-between mb-2">
              <Star className="h-5 w-5 text-indigo-600" />
              <span className="text-2xl font-bold text-indigo-700">
                {performance.qualityScore?.toFixed(1) || '0.0'}/5
              </span>
            </div>
            <p className="text-xs text-indigo-600 font-medium">Quality Score</p>
          </div>
        </div>

        {/* Disputes */}
        {performance.disputeCount > 0 && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-amber-900">
                Disputes: {performance.disputeCount}
              </span>
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300">
                Needs Attention
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
