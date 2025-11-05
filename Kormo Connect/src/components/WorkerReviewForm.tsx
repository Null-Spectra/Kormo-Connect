import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/forms';
import { Star, Send, X, Award, Target, Shield, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface WorkerReviewFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  workerName: string;
  taskId: string;
  companyId: string;
  onSubmit: (review: ReviewData) => Promise<void>;
}

export interface ReviewData {
  taskId: string;
  workerId: string;
  companyId: string;
  qualityRating: number;
  timelinessRating: number;
  reliabilityRating: number;
  overallRating: number;
}

const StarRating = ({ 
  rating, 
  onChange, 
  label,
  icon,
  description
}: { 
  rating: number; 
  onChange: (rating: number) => void; 
  label: string;
  icon?: React.ReactNode;
  description?: string;
}) => {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
      <div className="flex items-center space-x-3 mb-4">
        {icon && <div className="p-2 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-lg">{icon}</div>}
        <div className="flex-1">
          <Label className="text-lg font-semibold text-gray-800 block">{label}</Label>
          {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
        </div>
      </div>
      <div className="flex items-center space-x-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            className="transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 rounded-lg p-1"
          >
            <Star
              className={`h-10 w-10 transition-colors duration-200 ${
                star <= (hoverRating || rating)
                  ? 'fill-yellow-400 text-yellow-400 drop-shadow-sm'
                  : 'fill-gray-200 text-gray-300 hover:fill-yellow-200'
              }`}
            />
          </button>
        ))}
        <div className="ml-4 px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border">
          <span className="text-sm font-bold text-gray-700">
            {rating > 0 ? `${rating}/5` : 'Not rated'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const WorkerReviewForm: React.FC<WorkerReviewFormProps> = ({
  open,
  onOpenChange,
  workerId,
  workerName,
  taskId,
  companyId,
  onSubmit,
}) => {
  const [qualityRating, setQualityRating] = useState(0);
  const [timelinessRating, setTimelinessRating] = useState(0);
  const [reliabilityRating, setReliabilityRating] = useState(0);
  const [overallRating, setOverallRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (overallRating === 0 || qualityRating === 0 || reliabilityRating === 0 || timelinessRating === 0) {
      alert('Please provide all required ratings: Rating, Quality Score, Reliability Score, and On-Time Rate');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        taskId,
        workerId,
        companyId,
        qualityRating,
        timelinessRating,
        reliabilityRating,
        overallRating,
      });

      // Reset form
      setQualityRating(0);
      setTimelinessRating(0);
      setReliabilityRating(0);
      setOverallRating(0);
      onOpenChange(false);
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setQualityRating(0);
    setTimelinessRating(0);
    setReliabilityRating(0);
    setOverallRating(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Give Feedback to Professional</DialogTitle>
          <DialogDescription>
            Provide feedback for <span className="font-semibold text-gray-900">{workerName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-6">
          <div className="bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-8 shadow-lg">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4 shadow-lg">
                <Award className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Rate Professional Performance</h3>
              <p className="text-gray-600">
                Provide detailed feedback to help build this professional's reputation
              </p>
            </div>
            
            <div className="space-y-6">
              <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <StarRating
                  rating={overallRating}
                  onChange={setOverallRating}
                  label="Rating"
                  description="Overall satisfaction with the professional's service"
                  icon={<Award className="h-6 w-6 text-blue-600" />}
                />
              </div>

              <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <StarRating
                  rating={qualityRating}
                  onChange={setQualityRating}
                  label="Quality Score"
                  description="The final quality of the work delivered"
                  icon={<Target className="h-6 w-6 text-green-600" />}
                />
              </div>

              <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <StarRating
                  rating={reliabilityRating}
                  onChange={setReliabilityRating}
                  label="Reliability Score"
                  description="How reliable and communicative was the professional?"
                  icon={<Shield className="h-6 w-6 text-purple-600" />}
                />
              </div>

              <div className="bg-white border border-blue-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
                <StarRating
                  rating={timelinessRating}
                  onChange={setTimelinessRating}
                  label="On-Time Rate"
                  description="Was the job completed by the agreed-upon deadline?"
                  icon={<Clock className="h-6 w-6 text-orange-600" />}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={submitting}
            className="flex items-center"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || overallRating === 0 || qualityRating === 0 || reliabilityRating === 0 || timelinessRating === 0}
            className="flex items-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
