UPDATE `RolePermission`
SET `actions` = JSON_ARRAY_APPEND(`actions`, '$', 'product.write')
WHERE `roleCode` IN ('admin', 'boss')
  AND JSON_CONTAINS(`actions`, JSON_QUOTE('product.write')) = 0;
