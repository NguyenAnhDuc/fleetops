<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * Bảng ledger ghi nhận các lần chuyển "tiền tồn" từ xe này sang xe khác.
     * Tiền tồn của xe được tính động từ orders; bảng này được cộng/trừ vào đó:
     *   tiền tồn = tổng từ orders + tổng nhận vào (to_vehicle) - tổng chuyển đi (from_vehicle).
     *
     * @return void
     */
    public function up()
    {
        Schema::create('vehicle_money_transfers', function (Blueprint $table) {
            $table->increments('id');
            $table->string('_key')->nullable();
            $table->string('uuid', 191)->nullable()->index();
            $table->string('public_id', 191)->nullable()->unique();
            $table->uuid('company_uuid')->nullable()->index();

            // Xe chuyển đi / xe nhận (khóa chính của giao dịch)
            $table->uuid('from_vehicle_uuid')->nullable()->index('vmt_from_vehicle_uuid_index');
            $table->uuid('to_vehicle_uuid')->nullable()->index('vmt_to_vehicle_uuid_index');

            // Snapshot tài xế đang cầm xe tại thời điểm chuyển (để tra cứu lịch sử chính xác)
            $table->uuid('from_driver_uuid')->nullable()->index('vmt_from_driver_uuid_index');
            $table->uuid('to_driver_uuid')->nullable()->index('vmt_to_driver_uuid_index');

            // Người thực hiện lệnh chuyển (tài xế tạo trên App)
            $table->uuid('created_by_uuid')->nullable()->index('vmt_created_by_uuid_index');

            // amount: số tài xế YÊU CẦU chuyển. approved_amount: số admin PHÊ DUYỆT (có thể khác).
            $table->decimal('amount', 15, 2)->default(0);
            $table->decimal('approved_amount', 15, 2)->nullable();
            $table->string('currency')->nullable()->default('VND');
            $table->text('note')->nullable();
            $table->timestamp('transferred_at')->nullable()->index();

            // Workflow phê duyệt: pending -> approved / rejected.
            // Chỉ bản ghi 'approved' mới được tính vào tiền tồn (dùng approved_amount).
            $table->string('status')->default('pending')->index();
            $table->uuid('approved_by_uuid')->nullable()->index('vmt_approved_by_uuid_index');
            $table->timestamp('approved_at')->nullable();
            $table->text('approval_note')->nullable();

            $table->softDeletes();
            $table->timestamp('created_at')->nullable()->index();
            $table->timestamp('updated_at')->nullable();

            $table->unique(['uuid']);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('vehicle_money_transfers');
    }
};
