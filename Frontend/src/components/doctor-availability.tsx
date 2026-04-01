import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  Calendar,
  Save,
  RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AvailabilitySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  isAvailable: boolean;
}

interface DoctorAvailabilityProps {
  doctorId: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
];

export function DoctorAvailability({ doctorId }: DoctorAvailabilityProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [availability, setAvailability] = useState<AvailabilitySlot[]>(
    DAYS_OF_WEEK.map(day => ({
      dayOfWeek: day.value,
      startTime: '09:00',
      endTime: '17:00',
      slotDuration: 30,
      isAvailable: day.value >= 1 && day.value <= 5, // Mon-Fri default
    }))
  );

  // Fetch existing availability
  const { data: existingData, isLoading } = useQuery({
    queryKey: ["doctor-availability", doctorId],
    queryFn: async () => {
      const res = await fetch(`/api/doctor/${doctorId}/availability`);
      if (!res.ok) throw new Error("Failed to fetch availability");
      return res.json();
    },
  });

  // Update local state when data is fetched
  useEffect(() => {
    if (existingData?.availability && existingData.availability.length > 0) {
      const updatedAvailability = DAYS_OF_WEEK.map(day => {
        const existing = existingData.availability.find((a: AvailabilitySlot) => a.dayOfWeek === day.value);
        if (existing) {
          return {
            dayOfWeek: day.value,
            startTime: existing.startTime,
            endTime: existing.endTime,
            slotDuration: existing.slotDuration,
            isAvailable: existing.isAvailable,
          };
        }
        return {
          dayOfWeek: day.value,
          startTime: '09:00',
          endTime: '17:00',
          slotDuration: 30,
          isAvailable: false,
        };
      });
      setAvailability(updatedAvailability);
    }
  }, [existingData]);

  // Save availability mutation
  const saveAvailabilityMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/doctor/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doctorId,
          availability: availability.filter(a => a.isAvailable),
        }),
      });
      if (!res.ok) throw new Error("Failed to save availability");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Your availability has been updated",
      });
      queryClient.invalidateQueries({ queryKey: ["doctor-availability", doctorId] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save availability",
        variant: "destructive",
      });
    },
  });

  const updateDayAvailability = (dayOfWeek: number, updates: Partial<AvailabilitySlot>) => {
    setAvailability(prev =>
      prev.map(slot =>
        slot.dayOfWeek === dayOfWeek ? { ...slot, ...updates } : slot
      )
    );
  };

  const resetToDefaults = () => {
    setAvailability(
      DAYS_OF_WEEK.map(day => ({
        dayOfWeek: day.value,
        startTime: '09:00',
        endTime: '17:00',
        slotDuration: 30,
        isAvailable: day.value >= 1 && day.value <= 5,
      }))
    );
  };

  const copyToAllDays = (sourceDayOfWeek: number) => {
    const sourceSlot = availability.find(a => a.dayOfWeek === sourceDayOfWeek);
    if (!sourceSlot) return;

    setAvailability(prev =>
      prev.map(slot => ({
        ...slot,
        startTime: sourceSlot.startTime,
        endTime: sourceSlot.endTime,
        slotDuration: sourceSlot.slotDuration,
      }))
    );

    toast({
      title: "Copied",
      description: `Times copied from ${DAYS_OF_WEEK.find(d => d.value === sourceDayOfWeek)?.label} to all days`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading availability...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Set Your Availability
              </CardTitle>
              <CardDescription>
                Configure your weekly schedule for patient appointments
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetToDefaults}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
              <Button
                onClick={() => saveAvailabilityMutation.mutate()}
                disabled={saveAvailabilityMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveAvailabilityMutation.isPending ? "Saving..." : "Save Schedule"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {DAYS_OF_WEEK.map((day) => {
              const slot = availability.find(a => a.dayOfWeek === day.value)!;
              return (
                <div
                  key={day.value}
                  className={`p-4 rounded-lg border ${
                    slot.isAvailable ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={slot.isAvailable}
                        onCheckedChange={(checked) => updateDayAvailability(day.value, { isAvailable: checked })}
                      />
                      <span className={`font-medium w-24 ${slot.isAvailable ? 'text-green-700' : 'text-gray-500'}`}>
                        {day.label}
                      </span>
                    </div>

                    {slot.isAvailable && (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <Select
                            value={slot.startTime}
                            onValueChange={(value) => updateDayAvailability(day.value, { startTime: value })}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map(time => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-muted-foreground">to</span>
                          <Select
                            value={slot.endTime}
                            onValueChange={(value) => updateDayAvailability(day.value, { endTime: value })}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIME_OPTIONS.map(time => (
                                <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground">Slot:</Label>
                          <Select
                            value={slot.slotDuration.toString()}
                            onValueChange={(value) => updateDayAvailability(day.value, { slotDuration: parseInt(value) })}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DURATION_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value.toString()}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToAllDays(day.value)}
                          className="text-xs"
                        >
                          Copy to all
                        </Button>
                      </div>
                    )}

                    {!slot.isAvailable && (
                      <span className="text-sm text-gray-500 italic">Not available</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-700 mb-2">Quick Tips</h4>
            <ul className="text-sm text-blue-600 space-y-1">
              <li>Toggle days on/off to set your working days</li>
              <li>Set your start and end times for each day</li>
              <li>Choose slot duration (how long each appointment lasts)</li>
              <li>Use "Copy to all" to apply the same times to all days</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default DoctorAvailability;
