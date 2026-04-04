import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useApiMutation } from "@/hooks/useApi";
import { Plus } from "lucide-react";

const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(255, "Name must be less than 255 characters"),
  description: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  logoUrl: z.string().url("Must be a valid URL").optional().or(z.literal(""))
});

type CreateOrganizationData = z.infer<typeof createOrganizationSchema>;

interface CreateOrganizationDialogProps {
  trigger?: React.ReactNode;
}

export default function CreateOrganizationDialog({ trigger }: CreateOrganizationDialogProps) {
  const [open, setOpen] = useState(false);

  const form = useForm<CreateOrganizationData>({
    resolver: zodResolver(createOrganizationSchema),
    defaultValues: {
      name: "",
      description: "",
      website: "",
      logoUrl: ""
    }
  });

  const createMutation = useApiMutation({
    endpoint: "/api/organizations",
    method: "POST",
    invalidateQueries: [["/api/organizations"]],
    onSuccess: () => {
      toast.success("Success!", {
        description: "Organization created successfully",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Error", {
        description: error.message || "Failed to create organization",
      });
    },
  });

  const onSubmit = (data: CreateOrganizationData) => {
    // Clean up the data to remove empty strings
    const cleanData = {
      ...data,
      website: data.website || undefined,
      logoUrl: data.logoUrl || undefined,
      description: data.description || undefined
    };
    createMutation.mutate(cleanData);
  };

  const defaultTrigger = (
    <Button className="bg-professional-blue hover:bg-professional-blue/90 text-white">
      <Plus className="h-4 w-4 mr-2" />
      Add Organization
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Organization</DialogTitle>
          <DialogDescription>
            Create a new organization that can be reviewed by the community.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Google, Microsoft" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Brief description of the organization..." 
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Website</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="logoUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Logo URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com/logo.png" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="bg-professional-blue hover:bg-professional-blue/90"
              >
                {createMutation.isPending ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}