<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('fuel_reports', function (Blueprint $table) {
            // Đơn giá nhiên liệu (bắt buộc, hỗ trợ thập phân)
            // Tự động nhân với volume để ra amount
            $table->decimal('unit_price', 15, 2)->nullable()->after('currency');

            // Ngày tài xế đổ dầu (bắt buộc nhập từ phía user)
            $table->date('fueled_at')->nullable()->after('unit_price');

            // Thể tích nhiên liệu phụ (optional, mục đích riêng doanh nghiệp)
            $table->decimal('volume_extra', 15, 2)->nullable()->after('volume');

            // Số tiền phụ (optional, mục đích riêng doanh nghiệp)
            $table->decimal('amount_extra', 15, 2)->nullable()->after('amount');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('fuel_reports', function (Blueprint $table) {
            $table->dropColumn([
                'unit_price',
                'fueled_at',
                'volume_extra',
                'amount_extra',
            ]);
        });
    }
};
