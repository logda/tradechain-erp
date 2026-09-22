ALTER TABLE `RolePermission`
  ADD COLUMN `actions` JSON NULL;

UPDATE `RolePermission`
SET `actions` = JSON_ARRAY(
  'admin.user.write',
  'admin.role.write',
  'sales.quote.write',
  'sales.inquiry.submit',
  'sales.order.write',
  'sales.sample.submit',
  'sales.sample.approve',
  'sales.sample.execute',
  'purchase.order.submit',
  'purchase.order.approve',
  'shipment.update',
  'after_sales.process',
  'boss.confirm',
  'finance.confirm'
)
WHERE `roleCode` = 'admin';

UPDATE `RolePermission`
SET `actions` = JSON_ARRAY(
  'sales.order.write',
  'sales.sample.approve',
  'purchase.order.approve',
  'after_sales.process',
  'boss.confirm',
  'finance.confirm'
)
WHERE `roleCode` = 'boss';

UPDATE `RolePermission`
SET `actions` = JSON_ARRAY(
  'sales.quote.write',
  'sales.inquiry.submit',
  'sales.order.write',
  'sales.sample.submit',
  'sales.sample.approve',
  'sales.sample.execute'
)
WHERE `roleCode` = 'sales_manager';

UPDATE `RolePermission`
SET `actions` = JSON_ARRAY(
  'sales.quote.write',
  'sales.inquiry.submit',
  'sales.order.write',
  'sales.sample.submit',
  'sales.sample.execute'
)
WHERE `roleCode` = 'sales';

UPDATE `RolePermission`
SET `actions` = JSON_ARRAY(
  'purchase.order.submit',
  'purchase.order.approve',
  'shipment.update',
  'after_sales.process'
)
WHERE `roleCode` = 'purchase_manager';

UPDATE `RolePermission`
SET `actions` = JSON_ARRAY(
  'purchase.order.submit',
  'shipment.update',
  'after_sales.process'
)
WHERE `roleCode` = 'purchase';

ALTER TABLE `RolePermission`
  MODIFY COLUMN `actions` JSON NOT NULL;
