Toggle push notifications: $ARGUMENTS

Rules:
- If argument is "on": call the `toggle_notifications` MCP tool with `enabled: true`, then confirm to the user.
- If argument is "off": call the `toggle_notifications` MCP tool with `enabled: false`, then confirm to the user.
- If argument is "status" or empty: call the `notification_status` MCP tool and report the result.
- Any other argument: explain usage — `/notify on`, `/notify off`, `/notify status`.
