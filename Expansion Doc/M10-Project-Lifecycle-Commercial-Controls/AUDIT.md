# M10 audit note

The completion safeguard was audited against the historical MVP regression. The observed block was valid: Project 1 retained milestone-generated invoices in `PENDING_REVIEW`. Completion would otherwise release contractors before the Vendor resolved the financial workflow.

The regression now uses the supported Vendor invoice-review endpoint to resolve that state, then confirms completion releases the historical assignments. Production completion logic is unchanged.
